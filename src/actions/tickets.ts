"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, type SessionUser } from "@/lib/auth";
import { isManager, ticketPermissions, ticketScope } from "@/lib/access";
import { nextTicketNumber } from "@/lib/ticket-number";
import { notify, teamMemberIds } from "@/lib/notify";
import { pickFiles, removeStoredFile, saveFile, validateFiles } from "@/lib/storage";
import {
  EGYPTIAN, TEAM, TRIAGE_LABELS, identityError, normalizeDigits, parseMentions,
  researchOutcome, slaDeadlineFor, transferTargets, triageHolders,
} from "@/lib/workflow";

type Result = { ok: true; warning?: string } | { ok: false; error: string };

async function guard(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "حصل خطأ";
    return { ok: false, error: msg };
  }
}

async function loadTicket(ticketId: string) {
  return prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { teams: { include: { team: { select: { id: true, code: true, name: true } } } } },
  });
}
type LoadedTicket = NonNullable<Awaited<ReturnType<typeof loadTicket>>>;

async function loadWithPerms(user: SessionUser, ticketId: string) {
  const ticket = await loadTicket(ticketId);
  if (!ticket) throw new Error("التيكت غير موجودة");
  const perms = ticketPermissions(user, ticket);
  if (!perms.canView) throw new Error("غير مصرح");
  return { ticket, perms };
}

function refresh(ticketId?: string) {
  if (ticketId) revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
}

async function teamsByCode(codes: string[]) {
  const teams = await prisma.team.findMany({ where: { code: { in: codes } } });
  if (teams.length !== codes.length) throw new Error("تيمات مسار الدكاترة مش متعرّفة — راجع صفحة التيمات");
  return teams;
}

// يحط التيم كـ holder (أو يرقّيه لو كان observer)
function upsertHolder(tx: Prisma.TransactionClient, ticketId: string, teamId: string) {
  return tx.ticketTeam.upsert({
    where: { ticketId_teamId: { ticketId, teamId } },
    update: { access: "holder" },
    create: { ticketId, teamId, access: "holder" },
  });
}

function setObserver(tx: Prisma.TransactionClient, ticketId: string, teamIds: string[]) {
  return tx.ticketTeam.updateMany({
    where: { ticketId, teamId: { in: teamIds } },
    data: { access: "observer" },
  });
}

// ─── بيانات المستفيد ────────────────────────────────────
const detailsSchema = z.object({
  beneficiaryName: z.string().trim().min(2, "اسم الحالة مطلوب"),
  phone1: z.string().trim().regex(/^\+?[0-9\s-]{6,20}$/, "رقم الموبايل 1 غير صحيح"),
  phone2: z.string().trim().regex(/^\+?[0-9\s-]{6,20}$/, "رقم الموبايل 2 غير صحيح").or(z.literal("")),
  caseCode: z.string().trim().max(50),
  relationship: z.string().trim().min(1, "صلة القرابة مطلوبة"),
  nationality: z.string().trim().min(2, "الجنسية مطلوبة"),
  nationalId: z.string().trim(),
  unhcrNumber: z.string().trim().max(50),
  description: z.string().trim().max(5000),
});

function readDetails(form: FormData) {
  const s = (k: string) => normalizeDigits(String(form.get(k) ?? ""));
  let nationality = s("nationality");
  if (nationality === "أخرى") nationality = s("nationalityOther").trim() || nationality;
  const parsed = detailsSchema.safeParse({
    beneficiaryName: s("beneficiaryName"), phone1: s("phone1"), phone2: s("phone2"),
    caseCode: s("caseCode"), relationship: s("relationship"), nationality,
    nationalId: s("nationalId").replace(/\s/g, ""), unhcrNumber: s("unhcrNumber"),
    description: s("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" } as const;
  const d = parsed.data;
  const idErr = identityError(d.nationality, d.nationalId, d.unhcrNumber);
  if (idErr) return { error: idErr } as const;
  const egyptian = d.nationality === EGYPTIAN;
  return {
    data: {
      beneficiaryName: d.beneficiaryName,
      phone1: d.phone1,
      phone2: d.phone2 || null,
      caseCode: d.caseCode || null,
      relationship: d.relationship,
      nationality: d.nationality,
      nationalId: egyptian ? d.nationalId : null,
      unhcrNumber: egyptian ? null : d.unhcrNumber,
      description: d.description || null,
    },
  } as const;
}

// ─── إنشاء ───────────────────────────────────────────────
const createMeta = z.object({
  type: z.enum(["new_case", "follow_up", "emergency"], { message: "اختار نوع الحالة" }),
  source: z.enum(["call_center", "social_media", "reception", "clinics"], { message: "اختار مصدر الحالة" }),
  teamId: z.string().min(1, "اختار التيم اللي هتتحول له التيكت"),
});

export async function createTicket(form: FormData): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    if (user.role === "viewer") return { ok: false, error: "غير مصرح" };

    const meta = createMeta.safeParse({ type: form.get("type"), source: form.get("source"), teamId: form.get("teamId") });
    if (!meta.success) return { ok: false, error: meta.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    const details = readDetails(form);
    if ("error" in details) return { ok: false, error: details.error! };

    const files = pickFiles(form);
    const fileErr = validateFiles(files);
    if (fileErr) return { ok: false, error: fileErr };

    const allTeams = await prisma.team.findMany();
    const target = transferTargets(allTeams, user.teamIds, isManager(user)).find((t) => t.id === meta.data.teamId);
    if (!target) return { ok: false, error: "مش مسموح تحوّل للتيم ده" };

    const ticketNumber = await nextTicketNumber(meta.data.type);
    const createdAt = new Date();
    const saved = await Promise.all(files.map(saveFile));

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        type: meta.data.type,
        source: meta.data.source,
        ...details.data,
        createdById: user.id,
        createdAt,
        slaDeadline: slaDeadlineFor(meta.data.type, createdAt),
        teams: { create: { teamId: target.id, access: "holder" } },
        attachments: { create: saved.map((f) => ({ ...f, uploadedById: user.id })) },
        events: {
          create: {
            actorId: user.id, action: "created",
            metadata: { to: target.name, type: meta.data.type, source: meta.data.source, files: saved.length },
          },
        },
      },
    });

    await notify({
      userIds: await teamMemberIds([target.id], user.id),
      ticketId: ticket.id,
      type: meta.data.type === "emergency" ? "emergency" : "new_ticket",
      title: `${meta.data.type === "emergency" ? "🚨 طوارئ" : "تيكت جديدة"} ${ticket.ticketNumber} — ${target.name}`,
      body: details.data.beneficiaryName,
    });

    refresh();
    return { ok: true, id: ticket.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "حصل خطأ" };
  }
}

// ─── تعليقات / تحديثات + منشن ────────────────────────────
export async function addComment(ticketId: string, kind: "update" | "note", body: string): Promise<Result> {
  return guard(async () => {
    const user = await requireUser();
    const { ticket, perms } = await loadWithPerms(user, ticketId);
    if (!perms.canComment) return { ok: false, error: "غير مصرح" };
    const clean = body.trim();
    if (!clean) return { ok: false, error: "اكتب حاجة الأول" };
    if (clean.length > 5000) return { ok: false, error: "النص طويل جداً" };

    // المنشن بيوصل بس للي يقدر يشوف التيكت
    const usernames = parseMentions(clean);
    const candidates = usernames.length
      ? await prisma.user.findMany({
          where: { username: { in: usernames }, isActive: true },
          include: { teams: { include: { team: { select: { code: true, isActive: true } } } } },
        })
      : [];
    const mentioned = candidates.filter((c) => {
      const teams = c.teams.filter((m) => m.team.isActive);
      const asSession: SessionUser = {
        id: c.id, username: c.username, name: c.fullName, role: c.role,
        canReopen: c.canReopen, canExport: c.canExport,
        teamIds: teams.map((m) => m.teamId),
        teamCodes: teams.map((m) => m.team.code).filter((x): x is string => !!x),
      };
      return ticketPermissions(asSession, ticket).canView;
    });

    await prisma.ticketComment.create({
      data: { ticketId, authorId: user.id, kind, body: clean, mentions: mentioned.map((m) => m.username) },
    });

    const label = kind === "note" ? "ملاحظة" : "تحديث";
    await notify({
      userIds: mentioned.map((m) => m.id).filter((id) => id !== user.id),
      ticketId, type: "mention",
      title: `${user.name} عمل لك منشن في ${ticket.ticketNumber}`,
      body: clean.slice(0, 140),
    });
    const others = [ticket.createdById, ticket.assignedToId]
      .filter((id): id is string => !!id && id !== user.id && !mentioned.some((m) => m.id === id));
    await notify({
      userIds: others, ticketId, type: "comment",
      title: `${label} جديد على ${ticket.ticketNumber}`,
      body: clean.slice(0, 140),
    });

    const skipped = usernames.length - mentioned.length;
    refresh(ticketId);
    return skipped > 0
      ? { ok: true, warning: `${skipped} من المنشن مش موجودين أو مش من حقهم يشوفوا التيكت — ما اتبعتلهمش إشعار` }
      : { ok: true };
  });
}

// ─── تحويل لتيم تاني ──────────────────────────────────────
export async function transferTicket(ticketId: string, targetTeamId: string, note: string): Promise<Result> {
  return guard(async () => {
    const user = await requireUser();
    const { ticket, perms } = await loadWithPerms(user, ticketId);
    if (!perms.canAct) return { ok: false, error: "التيكت مش مع تيمك" };

    const holders = ticket.teams.filter((t) => t.access === "holder");
    const allTeams = await prisma.team.findMany();
    const target = transferTargets(allTeams, user.teamIds, isManager(user), holders.map((h) => h.teamId))
      .find((t) => t.id === targetTeamId);
    if (!target) return { ok: false, error: "مش مسموح تحوّل للتيم ده" };

    // التيمات اللي بتسلّم: تيمات المستخدم اللي ماسكة التيكت (المدير: كل الماسكين)
    const from = isManager(user) ? holders : holders.filter((h) => user.teamIds.includes(h.teamId));
    const fromIds = from.map((h) => h.teamId);
    // لو التيم الجديد مقيد على تيم المحوِّل (زي الهوت لاين دكتور) — التيم المحوِّل يفضل متابع
    const keepObserving = target.transferOnlyFromId && fromIds.includes(target.transferOnlyFromId)
      ? [target.transferOnlyFromId] : [];

    await prisma.$transaction([
      prisma.ticketTeam.deleteMany({ where: { ticketId, teamId: { in: fromIds.filter((id) => !keepObserving.includes(id)) } } }),
      prisma.ticketTeam.updateMany({ where: { ticketId, teamId: { in: keepObserving } }, data: { access: "observer" } }),
      prisma.ticketTeam.upsert({
        where: { ticketId_teamId: { ticketId, teamId: target.id } },
        update: { access: "holder" },
        create: { ticketId, teamId: target.id, access: "holder" },
      }),
      prisma.ticket.update({ where: { id: ticketId }, data: { assignedToId: null } }),
      prisma.ticketEvent.create({
        data: {
          ticketId, actorId: user.id, action: "transferred",
          metadata: { from: from.map((h) => h.team.name), to: target.name, note: note.trim() || null },
        },
      }),
    ]);

    await notify({
      userIds: await teamMemberIds([target.id], user.id),
      ticketId, type: "transferred",
      title: `${ticket.type === "emergency" ? "🚨 " : ""}تيكت ${ticket.ticketNumber} اتحولت لـ ${target.name}`,
      body: note.trim() || undefined,
    });
    refresh(ticketId);
    return { ok: true };
  });
}

// ─── الهوت لاين دكتور: تصنيف الحالة ───────────────────────
export async function triageTicket(ticketId: string, level: "emergency" | "urgent", note: string): Promise<Result> {
  return guard(async () => {
    const user = await requireUser();
    const { ticket, perms } = await loadWithPerms(user, ticketId);
    if (!perms.canTriage) return { ok: false, error: "التصنيف لتيم الهوت لاين دكتور بس" };
    if (level !== "emergency" && level !== "urgent") return { ok: false, error: "تصنيف غير صحيح" };

    const [hotlineDoctor] = await teamsByCode([TEAM.HOTLINE_DOCTOR]);
    const targets = await teamsByCode(triageHolders(level));

    await prisma.$transaction(async (tx) => {
      await setObserver(tx, ticketId, [hotlineDoctor.id]);
      for (const t of targets) await upsertHolder(tx, ticketId, t.id);
      await tx.ticket.update({
        where: { id: ticketId },
        data: { triageLevel: level, researchDecision: "pending", assignedToId: null },
      });
      await tx.ticketEvent.create({
        data: {
          ticketId, actorId: user.id, action: "triaged",
          metadata: { level, to: targets.map((t) => t.name), note: note.trim() || null },
        },
      });
    });

    await notify({
      userIds: await teamMemberIds(targets.map((t) => t.id), user.id),
      ticketId, type: "triaged",
      title: `حالة ${TRIAGE_LABELS[level]}: ${ticket.ticketNumber}`,
      body: note.trim() || undefined,
    });
    refresh(ticketId);
    return { ok: true };
  });
}

// ─── الأبحاث: قبول / رفض ──────────────────────────────────
export async function decideResearch(ticketId: string, decision: "accepted" | "rejected", comment: string): Promise<Result> {
  return guard(async () => {
    const user = await requireUser();
    const { ticket, perms } = await loadWithPerms(user, ticketId);
    if (!perms.canResearch) return { ok: false, error: "القرار لتيم الأبحاث بس" };
    if (decision !== "accepted" && decision !== "rejected") return { ok: false, error: "قرار غير صحيح" };
    const outcome = researchOutcome(decision);
    const text = comment.trim();
    if (outcome.requiresComment && text.length < 3) return { ok: false, error: "لازم تكتب سبب الرفض" };

    const [research] = await teamsByCode([TEAM.RESEARCH]);
    const add = outcome.addHolders.length ? await teamsByCode(outcome.addHolders) : [];
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      if (outcome.close) {
        await tx.ticket.update({
          where: { id: ticketId },
          data: {
            researchDecision: "rejected", researchDecidedAt: now, researchDecidedById: user.id,
            status: "closed", closedAt: now, closedById: user.id, closeReason: text,
          },
        });
      } else {
        await setObserver(tx, ticketId, [research.id]);
        for (const t of add) await upsertHolder(tx, ticketId, t.id);
        await tx.ticket.update({
          where: { id: ticketId },
          data: { researchDecision: "accepted", researchDecidedAt: now, researchDecidedById: user.id },
        });
      }
      if (text) await tx.ticketComment.create({ data: { ticketId, authorId: user.id, kind: "note", body: text } });
      await tx.ticketEvent.create({
        data: {
          ticketId, actorId: user.id, action: decision === "accepted" ? "research_accepted" : "research_rejected",
          metadata: { comment: text || null, to: add.map((t) => t.name) },
        },
      });
    });

    const allTeamIds = ticket.teams.map((t) => t.teamId);
    await notify({
      userIds: outcome.close
        ? [...(await teamMemberIds(allTeamIds, user.id)), ticket.createdById].filter((id) => id !== user.id)
        : await teamMemberIds(add.map((t) => t.id), user.id),
      ticketId, type: "research",
      title: outcome.close
        ? `❌ الأبحاث رفضت ${ticket.ticketNumber} واتقفلت`
        : `✅ الأبحاث قبلت ${ticket.ticketNumber} — للفولو اب دكتور`,
      body: text || undefined,
    });
    refresh(ticketId);
    return { ok: true };
  });
}

// ─── قفل / إعادة فتح ─────────────────────────────────────
export async function closeTicket(ticketId: string, reason: string): Promise<Result> {
  return guard(async () => {
    const user = await requireUser();
    const { ticket, perms } = await loadWithPerms(user, ticketId);
    if (!perms.canClose) return { ok: false, error: "غير مصرح" };
    const text = reason.trim();
    if (text.length < 3) return { ok: false, error: "اكتب سبب / ملخص القفل" };
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: "closed", closedAt: new Date(), closedById: user.id, closeReason: text,
        events: { create: { actorId: user.id, action: "closed", metadata: { reason: text } } },
      },
    });
    await notify({
      userIds: [ticket.createdById, ticket.assignedToId].filter((id): id is string => !!id && id !== user.id),
      ticketId, type: "closed", title: `تم قفل ${ticket.ticketNumber}`, body: text,
    });
    refresh(ticketId);
    return { ok: true };
  });
}

export async function reopenTicket(ticketId: string, note: string): Promise<Result> {
  return guard(async () => {
    const user = await requireUser();
    const { ticket, perms } = await loadWithPerms(user, ticketId);
    if (!perms.canReopen) return { ok: false, error: "إعادة الفتح محتاجة صلاحية من المدير" };
    const text = note.trim();
    if (text.length < 3) return { ok: false, error: "اكتب سبب إعادة الفتح" };
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: "pending", closedAt: null, closedById: null, closeReason: null,
        events: { create: { actorId: user.id, action: "reopened", metadata: { note: text } } },
      },
    });
    const holders = ticket.teams.filter((t) => t.access === "holder").map((t) => t.teamId);
    await notify({
      userIds: [...(await teamMemberIds(holders, user.id)), ticket.createdById].filter((id) => id !== user.id),
      ticketId, type: "reopened", title: `🔄 إعادة فتح ${ticket.ticketNumber}`, body: text,
    });
    refresh(ticketId);
    return { ok: true };
  });
}

// ─── إسناد لموظف من التيم ────────────────────────────────
export async function assignTicket(ticketId: string, assigneeId: string | null): Promise<Result> {
  return guard(async () => {
    const user = await requireUser();
    const { ticket, perms } = await loadWithPerms(user, ticketId);
    if (!perms.canAct) return { ok: false, error: "غير مصرح" };
    let name: string | null = null;
    if (assigneeId) {
      const holderIds = ticket.teams.filter((t) => t.access === "holder").map((t) => t.teamId);
      const member = await prisma.user.findFirst({
        where: { id: assigneeId, isActive: true, role: { not: "viewer" }, teams: { some: { teamId: { in: holderIds } } } },
      });
      if (!member) return { ok: false, error: "الموظف لازم يكون من التيم الماسك التيكت" };
      name = member.fullName;
    }
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assignedToId: assigneeId,
        events: { create: { actorId: user.id, action: "assigned", metadata: { to: name } } },
      },
    });
    if (assigneeId && assigneeId !== user.id) {
      await notify({ userIds: [assigneeId], ticketId, type: "assigned", title: `${ticket.ticketNumber} اتسندت لك` });
    }
    refresh(ticketId);
    return { ok: true };
  });
}

// ─── تعديل بيانات المستفيد (مع تسجيل التغيير في الهيستوري) ─
const FIELD_LABELS: Record<string, string> = {
  beneficiaryName: "الاسم", phone1: "موبايل 1", phone2: "موبايل 2", caseCode: "الكود",
  relationship: "صلة القرابة", nationality: "الجنسية", nationalId: "الرقم القومي",
  unhcrNumber: "رقم المفوضية", description: "الوصف",
};

export async function updateTicketDetails(ticketId: string, form: FormData): Promise<Result> {
  return guard(async () => {
    const user = await requireUser();
    const { ticket, perms } = await loadWithPerms(user, ticketId);
    if (!perms.canAct) return { ok: false, error: "غير مصرح" };
    const details = readDetails(form);
    if ("error" in details) return { ok: false, error: details.error! };

    const before = ticket as unknown as Record<string, string | null>;
    const changes = Object.entries(details.data)
      .filter(([k, v]) => (before[k] ?? null) !== v)
      .map(([k, v]) => ({ field: k, label: FIELD_LABELS[k], from: before[k] ?? null, to: v }));
    if (changes.length === 0) return { ok: true };

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        ...details.data,
        events: { create: { actorId: user.id, action: "details_updated", metadata: { changes } } },
      },
    });
    refresh(ticketId);
    return { ok: true };
  });
}

// ─── مرفقات ──────────────────────────────────────────────
export async function uploadAttachments(ticketId: string, form: FormData): Promise<Result> {
  return guard(async () => {
    const user = await requireUser();
    const { perms } = await loadWithPerms(user, ticketId);
    if (!perms.canComment) return { ok: false, error: "غير مصرح" };
    const files = pickFiles(form);
    if (files.length === 0) return { ok: false, error: "اختار ملف" };
    const err = validateFiles(files);
    if (err) return { ok: false, error: err };
    const saved = await Promise.all(files.map(saveFile));
    await prisma.$transaction([
      prisma.attachment.createMany({ data: saved.map((f) => ({ ...f, ticketId, uploadedById: user.id })) }),
      prisma.ticketEvent.create({
        data: { ticketId, actorId: user.id, action: "attachment_added", metadata: { files: saved.map((f) => f.fileName) } },
      }),
    ]);
    refresh(ticketId);
    return { ok: true };
  });
}

// ─── حذف نهائي (المدير بس) ────────────────────────────────
export async function deleteTicket(ticketId: string): Promise<Result> {
  return guard(async () => {
    const user = await requireUser();
    if (!isManager(user)) return { ok: false, error: "المدير بس" };
    const files = await prisma.attachment.findMany({ where: { ticketId }, select: { storageKey: true } });
    await prisma.ticket.delete({ where: { id: ticketId } });
    await Promise.all(files.map((f) => removeStoredFile(f.storageKey)));
    refresh();
    return { ok: true };
  });
}

// ─── للعرض ───────────────────────────────────────────────
export async function getTicketForView(ticketId: string) {
  const user = await requireUser();
  const ticket = await prisma.ticket.findFirst({
    where: { AND: [{ id: ticketId }, ticketScope(user)] },
    include: {
      teams: { include: { team: true }, orderBy: { addedAt: "asc" } },
      createdBy: { select: { fullName: true, username: true } },
      assignedTo: { select: { id: true, fullName: true } },
      closedBy: { select: { fullName: true } },
      researchDecidedBy: { select: { fullName: true } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { fullName: true, username: true } } } },
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { fullName: true } } } },
      attachments: { orderBy: { createdAt: "asc" }, include: { uploadedBy: { select: { fullName: true } } } },
    },
  });
  if (!ticket) return null;
  return { ticket, perms: ticketPermissions(user, ticket), user };
}

export type TicketView = NonNullable<Awaited<ReturnType<typeof getTicketForView>>>;
export type { LoadedTicket };
