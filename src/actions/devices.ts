"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, type SessionUser } from "@/lib/auth";
import { isManager, ticketScope } from "@/lib/access";
import { logSystem } from "@/lib/audit";
import { notify, teamMemberIds } from "@/lib/notify";
import { nextTicketNumber } from "@/lib/ticket-number";
import { fetchCaseHistory, fetchCasePatient, type CaseHistory, type CasePatient } from "@/lib/cases";
import {
  DEVICE_STAGE_LABELS, DEVICE_STAGE_TEAM, DEVICE_STATUS_LABELS, DEVICE_TYPES, GENDERS, NO_SLA_DEADLINE, TEAM,
  deviceDecisionOutcome, normalizeDigits, type DeviceStage, type DeviceStatus,
} from "@/lib/workflow";

type Result = { ok: true } | { ok: false; error: string };
const fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "حدث خطأ" });

const memberOf = (u: SessionUser, code: string) => isManager(u) || u.teamCodes.includes(code);

function refresh(ticketId?: string) {
  if (ticketId) revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/devices");
  revalidatePath("/dashboard");
}

async function teamByCode(code: string) {
  const t = await prisma.team.findUnique({ where: { code } });
  if (!t) throw new Error("الفريق غير معرَّف — يُرجى مراجعة صفحة الفرق");
  return t;
}

// التذكرة بتنتقل لفريق المرحلة الجديدة (هو بس اللي «لديه» التذكرة)
async function moveHolder(tx: Prisma.TransactionClient, ticketId: string, teamId: string) {
  await tx.ticketTeam.deleteMany({ where: { ticketId, access: "holder", teamId: { not: teamId } } });
  await tx.ticketTeam.upsert({
    where: { ticketId_teamId: { ticketId, teamId } },
    update: { access: "holder" },
    create: { ticketId, teamId, access: "holder" },
  });
}

const inStock = (type: string) => prisma.device.count({ where: { type, status: "in_stock" } });

// ─── سيستم الحالات ───────────────────────────────────────
export async function lookupCasePatient(code: string): Promise<{ ok: true; data: CasePatient } | { ok: false; error: string }> {
  try {
    await requireUser();
    const c = normalizeDigits(String(code ?? "")).trim();
    if (!c) return { ok: false, error: "اكتب كود المريض" };
    return { ok: true, data: await fetchCasePatient(c) };
  } catch (e) { return fail(e); }
}

// آخر البحوث والقرارات من سيستم الحالات لتذكرة — بكود الحالة المسجل عليها، ولمن يقدر يشوف التذكرة بس
export async function lookupCaseHistory(ticketId: string): Promise<{ ok: true; data: CaseHistory } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const t = await prisma.ticket.findFirst({ where: { AND: [{ id: ticketId }, ticketScope(user)] }, select: { caseCode: true } });
    const c = normalizeDigits(t?.caseCode ?? "").trim();
    if (!t) return { ok: false, error: "التذكرة غير موجودة" };
    if (!c) return { ok: false, error: "التذكرة مفيهاش كود حالة" };
    return { ok: true, data: await fetchCaseHistory(c) };
  } catch (e) { return fail(e); }
}

// ─── طلب جهاز جديد ───────────────────────────────────────
const PHONE = /^\+?[0-9\s-]{6,20}$/;
const requestSchema = z.object({
  source: z.enum(["call_center", "social_media", "reception", "clinics"], { message: "اختر مصدر الطلب" }),
  caseCode: z.string().trim().min(1, "كود المريض مطلوب").max(50),
  beneficiaryName: z.string().trim().min(2, "اسم المريض مطلوب").max(120),
  nationality: z.string().trim().min(2, "الجنسية مطلوبة").max(40),
  gender: z.enum(GENDERS as [string, ...string[]], { message: "اختر النوع" }),
  age: z.string().trim().regex(/^\d{1,3}$/, "العمر بالسنوات مطلوب").refine((v) => Number(v) <= 120, "العمر غير صحيح"),
  religion: z.string().trim().max(30),
  governorate: z.string().trim().min(2, "المحافظة مطلوبة").max(40),
  area: z.string().trim().max(80),
  city: z.string().trim().max(80),
  address: z.string().trim().min(4, "العنوان بالتفصيل مطلوب").max(400),
  phone1: z.string().trim().regex(PHONE, "رقم الهاتف الأول غير صحيح"),
  phone2: z.string().trim().regex(PHONE, "رقم الهاتف الثاني غير صحيح").or(z.literal("")),
  deviceType: z.string().refine((v) => DEVICE_TYPES.includes(v), "اختر نوع الجهاز"),
  nursingVisit: z.enum(["yes", "no"], { message: "حدد هل يحتاج زيارة تمريضية" }),
  nursingFrequency: z.string().trim().max(80),
  socialDecision: z.string().trim().max(1000),
  socialDecisionEnd: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, "تاريخ نهاية القرار غير صحيح"),
  hasContribution: z.enum(["yes", "no"], { message: "حدد هل توجد مساهمة" }),
  contributionType: z.string().trim().max(20),
  contributionAmount: z.string().trim().regex(/^(\d+(\.\d+)?)?$/, "مبلغ المساهمة أرقام فقط"),
  notes: z.string().trim().max(2000),
});

function readRequest(form: FormData) {
  const s = (k: string) => normalizeDigits(String(form.get(k) ?? ""));
  const parsed = requestSchema.safeParse(Object.fromEntries(Object.keys(requestSchema.shape).map((k) => [k, s(k)])));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" } as const;
  const d = parsed.data;
  if (d.nursingVisit === "yes" && !d.nursingFrequency) return { error: "اكتب الزيارة التمريضية كل قد إيه" } as const;
  if (d.hasContribution === "yes") {
    if (d.contributionType !== "دورية" && d.contributionType !== "مرة واحدة") return { error: "اختر نوع المساهمة" } as const;
    if (!d.contributionAmount) return { error: "اكتب مبلغ المساهمة" } as const;
  }
  return { data: d } as const;
}

export async function createDeviceRequest(form: FormData): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    if (user.role === "viewer") return { ok: false, error: "غير مصرح" };
    const r = readRequest(form);
    if ("error" in r) return { ok: false, error: r.error! };
    const d = r.data;
    const doctor = await teamByCode(TEAM.FOLLOWUP_DOCTOR);
    const ticketNumber = await nextTicketNumber("device_request");
    const yes = (v: string) => v === "yes";

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber, type: "device_request", source: d.source,
        beneficiaryName: d.beneficiaryName, phone1: d.phone1, phone2: d.phone2 || null, caseCode: d.caseCode,
        relationship: "الحالة نفسها", nationality: d.nationality, gender: d.gender, age: Number(d.age),
        location: [d.governorate, d.city, d.area].filter(Boolean).join(" — "),
        description: d.notes || null,
        createdById: user.id, slaDeadline: NO_SLA_DEADLINE,
        teams: { create: { teamId: doctor.id, access: "holder" } },
        deviceRequest: {
          create: {
            deviceType: d.deviceType, religion: d.religion || null, governorate: d.governorate,
            city: d.city || null, area: d.area || null, address: d.address,
            nursingVisit: yes(d.nursingVisit), nursingFrequency: yes(d.nursingVisit) ? d.nursingFrequency : null,
            socialDecision: d.socialDecision || null,
            socialDecisionEnd: d.socialDecisionEnd ? new Date(`${d.socialDecisionEnd}T00:00:00+02:00`) : null,
            hasContribution: yes(d.hasContribution),
            contributionType: yes(d.hasContribution) ? d.contributionType : null,
            contributionAmount: yes(d.hasContribution) ? Number(d.contributionAmount) : null,
          },
        },
        events: { create: { actorId: user.id, action: "created", metadata: { to: doctor.name, type: "device_request", device: d.deviceType } } },
      },
    });
    await notify({
      userIds: await teamMemberIds([doctor.id], user.id), ticketId: ticket.id, type: "new_ticket",
      title: `🩺 طلب جهاز طبي ${ticket.ticketNumber} — ${d.deviceType}`, body: d.beneficiaryName,
    });
    refresh();
    return { ok: true, id: ticket.id };
  } catch (e) { return fail(e); }
}

// تعديل بيانات الطلب (أي حد يقدر يتصرف في التذكرة)
export async function updateDeviceRequest(ticketId: string, form: FormData): Promise<Result> {
  try {
    const user = await requireUser();
    if (user.role === "viewer") return { ok: false, error: "غير مصرح" };
    const t = await prisma.ticket.findFirst({ where: { AND: [{ id: ticketId }, ticketScope(user)] }, include: { deviceRequest: true } });
    if (!t?.deviceRequest) return { ok: false, error: "الطلب غير موجود" };
    if (t.status !== "pending") return { ok: false, error: "التذكرة مغلقة" };
    const r = readRequest(form);
    if ("error" in r) return { ok: false, error: r.error! };
    const d = r.data;
    const dr = t.deviceRequest;
    if (d.deviceType !== dr.deviceType && dr.deviceId) return { ok: false, error: "لا يمكن تغيير نوع الجهاز بعد صرفه" };
    const yes = (v: string) => v === "yes";
    const next = {
      deviceType: d.deviceType, religion: d.religion || null, governorate: d.governorate, city: d.city || null,
      area: d.area || null, address: d.address,
      nursingVisit: yes(d.nursingVisit), nursingFrequency: yes(d.nursingVisit) ? d.nursingFrequency : null,
      socialDecision: d.socialDecision || null,
      socialDecisionEnd: d.socialDecisionEnd ? new Date(`${d.socialDecisionEnd}T00:00:00+02:00`) : null,
      hasContribution: yes(d.hasContribution), contributionType: yes(d.hasContribution) ? d.contributionType : null,
      contributionAmount: yes(d.hasContribution) ? Number(d.contributionAmount) : null,
    };
    const tNext = {
      source: d.source, beneficiaryName: d.beneficiaryName, phone1: d.phone1, phone2: d.phone2 || null, caseCode: d.caseCode,
      nationality: d.nationality, gender: d.gender, age: Number(d.age), description: d.notes || null,
      location: [d.governorate, d.city, d.area].filter(Boolean).join(" — "),
    };
    // التغييرات بالقيمة القديمة والجديدة للسجل
    const LABELS: Record<string, string> = {
      deviceType: "نوع الجهاز", religion: "الديانة", governorate: "المحافظة", city: "المدينة", area: "المنطقة", address: "العنوان",
      nursingVisit: "زيارة تمريضية", nursingFrequency: "تكرار الزيارة", socialDecision: "القرار الاجتماعي",
      socialDecisionEnd: "نهاية القرار الاجتماعي", hasContribution: "مساهمة", contributionType: "نوع المساهمة",
      contributionAmount: "مبلغ المساهمة", beneficiaryName: "الاسم", phone1: "الهاتف الأول", phone2: "الهاتف الثاني",
      caseCode: "كود المريض", nationality: "الجنسية", gender: "النوع", age: "العمر", description: "ملاحظات",
    };
    const fmt = (v: unknown) => v == null || v === "" ? null : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "boolean" ? (v ? "نعم" : "لا") : String(v);
    const before = { ...dr, ...t } as Record<string, unknown>;
    const changes = Object.entries({ ...next, ...tNext })
      .filter(([k, v]) => LABELS[k] && fmt(before[k]) !== fmt(v))
      .map(([k, v]) => ({ label: LABELS[k], from: fmt(before[k]), to: fmt(v) }));
    if (!changes.length) return { ok: true };
    await prisma.$transaction([
      prisma.deviceRequest.update({ where: { id: dr.id }, data: { ...next, ...(next.socialDecisionEnd?.getTime() !== dr.socialDecisionEnd?.getTime() && { socialEndNotifiedAt: null }) } }),
      prisma.ticket.update({ where: { id: ticketId }, data: { ...tNext, events: { create: { actorId: user.id, action: "details_updated", metadata: { changes } } } } }),
    ]);
    refresh(ticketId);
    return { ok: true };
  } catch (e) { return fail(e); }
}

async function loadRequest(ticketId: string) {
  const t = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { deviceRequest: true } });
  if (!t?.deviceRequest) throw new Error("الطلب غير موجود");
  if (t.status !== "pending") throw new Error("التذكرة مغلقة");
  return { t, dr: t.deviceRequest };
}

// ─── موافقة / رفض (طبيب المتابعة ← الأبحاث ← القرارات) ─────
export async function deviceDecision(ticketId: string, decision: "approve" | "reject", note: string): Promise<Result> {
  try {
    const user = await requireUser();
    const { t, dr } = await loadRequest(ticketId);
    const stage = dr.stage as DeviceStage;
    if (!["doctor_review", "research_review", "decisions_review"].includes(stage)) return { ok: false, error: "الطلب ليس في مرحلة مراجعة" };
    if (!memberOf(user, DEVICE_STAGE_TEAM[stage]!)) return { ok: false, error: "القرار في هذه المرحلة لفريق " + DEVICE_STAGE_LABELS[stage].replace("عند ", "") };
    const text = note.trim();
    if (decision === "reject" && text.length < 3) return { ok: false, error: "اكتب سبب الرفض" };
    const out = deviceDecisionOutcome(stage, decision, decision === "approve" && stage === "decisions_review" ? await inStock(dr.deviceType) : 0);
    const team = out.team ? await teamByCode(out.team) : null;

    await prisma.$transaction(async (tx) => {
      if (team) await moveHolder(tx, ticketId, team.id);
      await tx.deviceRequest.update({ where: { id: dr.id }, data: { stage: out.next } });
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          assignedToId: null, receivedAt: null, receivedById: null,
          ...(out.close && { status: "closed", closedAt: new Date(), closedById: user.id, closeCategory: "رفض الطلب", closeReason: text }),
        },
      });
      if (text) await tx.ticketComment.create({ data: { ticketId, authorId: user.id, kind: "note", body: text } });
      await tx.ticketEvent.create({
        data: { ticketId, actorId: user.id, action: "device_stage", metadata: { from: stage, to: out.next, decision, note: text || null } },
      });
    });

    const title = decision === "approve"
      ? (out.next === "awaiting_stock"
        ? `⚠ ${t.ticketNumber}: ${dr.deviceType} غير متوفر — مطلوب توفيره (المشتريات)`
        : `طلب جهاز ${t.ticketNumber} — ${DEVICE_STAGE_LABELS[out.next]}`)
      : out.close ? `❌ رفض طبيب المتابعة طلب الجهاز ${t.ticketNumber}` : `↩ رجع طلب الجهاز ${t.ticketNumber} لطبيب المتابعة`;
    await notify({
      userIds: [...(team ? await teamMemberIds([team.id], user.id) : []), ...(out.close || decision === "reject" ? [t.createdById] : [])].filter((id) => id !== user.id),
      ticketId, type: "device", title, body: text || undefined,
    });
    refresh(ticketId);
    return { ok: true };
  } catch (e) { return fail(e); }
}

// المشتريات: الجهاز اتوفر → التذكرة تروح للمخزن
export async function markStockReady(ticketId: string): Promise<Result> {
  try {
    const user = await requireUser();
    const { t, dr } = await loadRequest(ticketId);
    if (dr.stage !== "awaiting_stock") return { ok: false, error: "الطلب ليس في انتظار توفر جهاز" };
    if (!memberOf(user, TEAM.PROCUREMENT) && !memberOf(user, TEAM.WAREHOUSE)) return { ok: false, error: "للمشتريات أو المخزن" };
    if ((await inStock(dr.deviceType)) === 0) return { ok: false, error: `لا يوجد «${dr.deviceType}» في المخزن بعد — أضِف الجهاز أولًا من صفحة الأجهزة` };
    const wh = await teamByCode(TEAM.WAREHOUSE);
    await prisma.$transaction(async (tx) => {
      await moveHolder(tx, ticketId, wh.id);
      await tx.deviceRequest.update({ where: { id: dr.id }, data: { stage: "awaiting_delivery" } });
      await tx.ticketEvent.create({ data: { ticketId, actorId: user.id, action: "device_stage", metadata: { from: "awaiting_stock", to: "awaiting_delivery" } } });
    });
    await notify({ userIds: await teamMemberIds([wh.id], user.id), ticketId, type: "device", title: `📦 ${t.ticketNumber}: ${dr.deviceType} جاهز للصرف` });
    refresh(ticketId);
    return { ok: true };
  } catch (e) { return fail(e); }
}

// المخزن: صرف جهاز معيّن (بالسيريال) للمريض — التذكرة تفضل مفتوحة
export async function deliverDevice(ticketId: string, deviceId: string, note: string): Promise<Result> {
  try {
    const user = await requireUser();
    const { t, dr } = await loadRequest(ticketId);
    if (!memberOf(user, TEAM.WAREHOUSE)) return { ok: false, error: "صرف الأجهزة للمخزن" };
    if (dr.stage !== "awaiting_delivery" && dr.stage !== "awaiting_stock") return { ok: false, error: "الطلب لم يُعتمد للصرف بعد" };
    const dev = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!dev || dev.type !== dr.deviceType) return { ok: false, error: "اختر جهازًا من نفس النوع المطلوب" };
    const wh = await teamByCode(TEAM.WAREHOUSE);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const taken = await tx.device.updateMany({ where: { id: deviceId, status: "in_stock" }, data: { status: "with_patient", currentTicketId: ticketId } });
      if (taken.count !== 1) throw new Error("الجهاز ده مش في المخزن دلوقتي — اختر جهازًا آخر");
      await moveHolder(tx, ticketId, wh.id);
      await tx.deviceRequest.update({ where: { id: dr.id }, data: { stage: "with_patient", deviceId, deliveredAt: now } });
      await tx.deviceEvent.create({ data: { deviceId, action: "delivered", fromStatus: "in_stock", toStatus: "with_patient", ticketId, actorId: user.id, note: note.trim() || null } });
      await tx.ticketEvent.create({ data: { ticketId, actorId: user.id, action: "device_delivered", metadata: { serial: dev.serial, type: dev.type, packing: dev.internalPacking } } });
    });
    await notify({ userIds: [t.createdById].filter((id) => id !== user.id), ticketId, type: "device", title: `✅ اتسلّم ${dev.type} (${dev.serial}) لمريض ${t.ticketNumber}` });
    refresh(ticketId);
    return { ok: true };
  } catch (e) { return fail(e); }
}

// المخزن: الجهاز رجع من المريض → يروح الهندسية للفحص، والتذكرة تتقفل
export async function returnDevice(ticketId: string, note: string): Promise<Result> {
  try {
    const user = await requireUser();
    const { t, dr } = await loadRequest(ticketId);
    if (!memberOf(user, TEAM.WAREHOUSE)) return { ok: false, error: "استلام الأجهزة للمخزن" };
    if (dr.stage !== "with_patient" || !dr.deviceId) return { ok: false, error: "لا يوجد جهاز مع المريض" };
    const dev = await prisma.device.findUnique({ where: { id: dr.deviceId } });
    const now = new Date();
    const text = note.trim();
    await prisma.$transaction(async (tx) => {
      await tx.device.update({ where: { id: dr.deviceId! }, data: { status: "maintenance", currentTicketId: null } });
      await tx.deviceEvent.create({ data: { deviceId: dr.deviceId!, action: "returned", fromStatus: "with_patient", toStatus: "maintenance", ticketId, actorId: user.id, note: text || null } });
      await tx.deviceRequest.update({ where: { id: dr.id }, data: { stage: "returned", returnedAt: now } });
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: "closed", closedAt: now, closedById: user.id, closeCategory: "تم استرجاع الجهاز", closeReason: text || null },
      });
      await tx.ticketEvent.create({ data: { ticketId, actorId: user.id, action: "device_returned", metadata: { serial: dev?.serial, type: dev?.type, note: text || null } } });
    });
    const eng = await teamByCode(TEAM.ENGINEERING);
    await notify({ userIds: await teamMemberIds([eng.id], user.id), ticketId, type: "device", title: `🔧 ${dr.deviceType} (${dev?.serial}) رجع من مريض — محتاج فحص` });
    refresh(ticketId);
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ─── المخزون ────────────────────────────────────────────
const deviceSchema = z.object({
  type: z.string().refine((v) => DEVICE_TYPES.includes(v), "اختر نوع الجهاز"),
  serial: z.string().trim().min(2, "السيريال مطلوب").max(80),
  internalPacking: z.string().trim().max(80),
  notes: z.string().trim().max(500),
});

export async function saveDevice(id: string | null, input: unknown): Promise<Result> {
  try {
    const user = await requireUser();
    if (!isManager(user)) return { ok: false, error: "إضافة الأجهزة وتعديلها للمدير" };
    const p = deviceSchema.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    const d = { ...p.data, serial: normalizeDigits(p.data.serial), internalPacking: normalizeDigits(p.data.internalPacking) || null, notes: p.data.notes || null };
    const dup = await prisma.device.findFirst({ where: { serial: { equals: d.serial, mode: "insensitive" }, ...(id && { NOT: { id } }) } });
    if (dup) return { ok: false, error: `السيريال ${d.serial} مسجّل بالفعل (${dup.type})` };
    if (id) {
      const before = await prisma.device.findUniqueOrThrow({ where: { id } });
      if (before.type !== d.type && before.status === "with_patient") return { ok: false, error: "لا يمكن تغيير نوع جهاز مع مريض" };
      await prisma.$transaction([
        prisma.device.update({ where: { id }, data: d }),
        prisma.deviceEvent.create({ data: { deviceId: id, action: "edited", actorId: user.id, note: `${before.type} · ${before.serial} · ${before.internalPacking ?? "—"} ← ${d.type} · ${d.serial} · ${d.internalPacking ?? "—"}` } }),
      ]);
    } else {
      const dev = await prisma.device.create({ data: { ...d, createdById: user.id } });
      await prisma.deviceEvent.create({ data: { deviceId: dev.id, action: "added", toStatus: "in_stock", actorId: user.id } });
      await logSystem(user.id, "device_added", { type: d.type, serial: d.serial });
      // في طلبات مستنية النوع ده؟ نبلّغ المخزن والمشتريات
      const waiting = await prisma.deviceRequest.count({ where: { deviceType: d.type, stage: "awaiting_stock" } });
      if (waiting) {
        const teams = await prisma.team.findMany({ where: { code: { in: [TEAM.WAREHOUSE, TEAM.PROCUREMENT] } }, select: { id: true } });
        await notify({ userIds: await teamMemberIds(teams.map((t) => t.id), user.id), type: "device", title: `📦 اتضاف ${d.type} للمخزن — في ${waiting} طلب مستني` });
      }
    }
    revalidatePath("/devices");
    return { ok: true };
  } catch (e) { return fail(e); }
}

// تغيير حالة جهاز مش مع مريض (الصرف والرجوع من التذكرة نفسها)
const MOVES: Record<string, { teams: string[]; label: string }> = {
  "in_stock>maintenance": { teams: [TEAM.WAREHOUSE, TEAM.ENGINEERING], label: "تحويل للهندسية" },
  "maintenance>in_stock": { teams: [TEAM.ENGINEERING], label: "سليم — رجوع للمخزن" },
  "maintenance>out_of_stock": { teams: [TEAM.ENGINEERING], label: "بره الاستوك — للمشتريات" },
  "in_stock>out_of_stock": { teams: [TEAM.ENGINEERING, TEAM.WAREHOUSE], label: "بره الاستوك — للمشتريات" },
  "out_of_stock>in_stock": { teams: [TEAM.PROCUREMENT], label: "اتوفر — رجوع للمخزن" },
  "out_of_stock>maintenance": { teams: [TEAM.PROCUREMENT], label: "تحويل للهندسية" },
};

export async function changeDeviceStatus(deviceId: string, to: DeviceStatus, note: string): Promise<Result> {
  try {
    const user = await requireUser();
    const dev = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!dev) return { ok: false, error: "الجهاز غير موجود" };
    const move = MOVES[`${dev.status}>${to}`];
    if (!move) return { ok: false, error: `لا يمكن النقل من «${DEVICE_STATUS_LABELS[dev.status]}» إلى «${DEVICE_STATUS_LABELS[to]}»` };
    if (!move.teams.some((c) => memberOf(user, c))) return { ok: false, error: "هذا الإجراء ليس من صلاحية فريقك" };
    const text = note.trim();
    if (to === "out_of_stock" && text.length < 3) return { ok: false, error: "اكتب السبب (مثلًا: عطل غير قابل للإصلاح)" };
    const done = await prisma.device.updateMany({ where: { id: deviceId, status: dev.status }, data: { status: to } });
    if (done.count !== 1) return { ok: false, error: "حالة الجهاز اتغيرت — حدّث الصفحة" };
    await prisma.deviceEvent.create({ data: { deviceId, action: "status", fromStatus: dev.status, toStatus: to, actorId: user.id, note: text || null } });
    const notifyCode = to === "maintenance" ? TEAM.ENGINEERING : to === "out_of_stock" ? TEAM.PROCUREMENT : null;
    if (notifyCode) {
      const tm = await teamByCode(notifyCode);
      await notify({
        userIds: await teamMemberIds([tm.id], user.id), type: "device",
        title: to === "out_of_stock" ? `🛒 ${dev.type} (${dev.serial}) بره الاستوك — مطلوب شراء` : `🔧 ${dev.type} (${dev.serial}) محتاج فحص`,
        body: text || undefined,
      });
    }
    revalidatePath("/devices");
    revalidatePath(`/devices/${deviceId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteDevice(deviceId: string): Promise<Result> {
  try {
    const user = await requireUser();
    if (!isManager(user)) return { ok: false, error: "للمدير فقط" };
    const dev = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!dev) return { ok: false, error: "الجهاز غير موجود" };
    if (dev.status === "with_patient") return { ok: false, error: "الجهاز مع مريض — لا يمكن حذفه" };
    const used = await prisma.deviceRequest.count({ where: { deviceId } });
    if (used) return { ok: false, error: "الجهاز اتصرف لمرضى قبل كده — غيّر حالته بدل الحذف علشان سجله يفضل" };
    await prisma.device.delete({ where: { id: deviceId } });
    await logSystem(user.id, "device_deleted", { type: dev.type, serial: dev.serial });
    revalidatePath("/devices");
    return { ok: true };
  } catch (e) { return fail(e); }
}
