"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canRequestAmbulance } from "@/lib/ambulance-access";
import {
  AMBULANCE_SERVICES, AMBULANCE_SOURCES, GOVERNORATES, REPORT_TYPES, TRIP_TYPES, WAIT_MODES,
  ambulanceEnabled, ambulanceStatus, createAmbulanceRequest,
} from "@/lib/ambulance";
import { normalizeDigits } from "@/lib/workflow";

type Result = { ok: true; remoteId: number } | { ok: false; error: string };

const PHONE = /^(\+?20)?0?1[0125]\d{8}$|^0[2-9]\d{7,9}$/;

// بيبعت طلب إسعاف لنظام إسعاف مرسال من بيانات الفورم، ويسجّله على التذكرة
export async function sendToAmbulance(ticketId: string, form: FormData): Promise<Result> {
  try {
    const user = await requireUser();
    if (!canRequestAmbulance(user)) return { ok: false, error: "طلب الإسعاف لفريق خط طوارئ مرسال" };
    if (!ambulanceEnabled()) return { ok: false, error: "ربط نظام الإسعاف غير مفعّل على السيرفر بعد" };
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, ticketNumber: true, status: true } });
    if (!ticket) return { ok: false, error: "التذكرة غير موجودة" };
    if (ticket.status !== "pending") return { ok: false, error: "التذكرة مغلقة" };

    const s = (k: string, max = 300) => normalizeDigits(String(form.get(k) ?? "")).trim().slice(0, max);
    const phone = (k: string) => s(k, 30).replace(/[^\d+]/g, "");
    const service = s("service", 30);
    if (!(AMBULANCE_SERVICES as readonly string[]).includes(service)) return { ok: false, error: "اختر نوع الخدمة" };
    const mersal = service === "حالة مرسال";

    const required: [string, string][] = [
      ["staff_name", "اسم الموظف المسئول"], ["staff_phone", "رقم الموظف"],
      ["deputy_name", "اسم من ينوب عنه"], ["deputy_phone", "رقم من ينوب عنه"],
      ...(mersal ? [["medical_approval", "الموافقة الطبية نصًا"], ["doctor_name", "اسم الطبيب صاحب الموافقة"], ["code", "الكود"]] as [string, string][] : []),
      ["phone", "رقم موبايل المبلغ"], ["patient", "اسم الحالة"], ["complaint", "الشكوى الصحية"],
      ["governorate", "المحافظة"], ["from_loc", "المكان المتواجد به المريض"], ["service_date", "تاريخ تقديم الخدمة"],
    ];
    for (const [k, label] of required) if (!s(k)) return { ok: false, error: `ناقص: ${label}` };
    for (const [k, label] of [["staff_phone", "رقم الموظف"], ["deputy_phone", "رقم من ينوب عنه"], ["phone", "رقم موبايل المبلغ"], ["phone2", "رقم الموبايل الآخر"]]) {
      if (phone(k) && !PHONE.test(phone(k))) return { ok: false, error: `${label} غير صحيح — 11 رقمًا يبدأ بـ 01` };
    }
    if (!GOVERNORATES.includes(s("governorate"))) return { ok: false, error: "اختر المحافظة" };
    const reportType = s("report_type", 80), tripType = s("trip_type", 30);
    if (!REPORT_TYPES.includes(reportType)) return { ok: false, error: "اختر نوع البلاغ" };
    if (!TRIP_TYPES.includes(tripType)) return { ok: false, error: "اختر نوع المشوار" };
    const sd = s("service_date", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sd)) return { ok: false, error: "تاريخ تقديم الخدمة غير صحيح" };
    for (const k of ["age", "weight"]) if (s(k) && !/^\d{1,3}(\.\d+)?$/.test(s(k))) return { ok: false, error: "السن والوزن أرقام فقط" };
    const yn = (k: string) => { const v = s(k, 10); return v === "أخرى" ? `أخرى: ${s(k + "_other", 200)}` : v; };
    const round = /عودة/.test(tripType);
    const waitMode = s("wait_mode", 60);
    if (round && !WAIT_MODES.includes(waitMode)) return { ok: false, error: "اختر ماذا ستفعل السيارة في الوجهة" };
    const source = AMBULANCE_SOURCES.includes(s("source", 40)) ? s("source", 40) : "الطوارئ";

    const notes = [`📋 من نظام التذاكر — ${ticket.ticketNumber} — أرسله ${user.name}`, s("notes", 600)].filter(Boolean).join(" — ");
    const body: Record<string, string> = {
      service, type: service, source, service_date: sd, service_time: s("service_time", 10), notes,
      staff_name: s("staff_name", 80), staff_phone: phone("staff_phone"), deputy_name: s("deputy_name", 80), deputy_phone: phone("deputy_phone"),
      medical_approval: mersal ? s("medical_approval", 1000) : "", doctor_name: mersal ? s("doctor_name", 80) : "", code: mersal ? s("code", 30) : "",
      reporter: s("reporter", 80), reporter_rel: s("reporter_rel", 40), phone: phone("phone"), phone2: phone("phone2"),
      patient: s("patient", 80), nationality: s("nationality", 40), age: s("age", 5), weight: s("weight", 6), gender: s("gender", 10),
      complaint: s("complaint", 1000), chronic: yn("chronic"), oxygen: yn("oxygen"),
      report_type: reportType, trip_type: tripType, governorate: s("governorate", 40), district: s("district", 80),
      from_loc: s("from_loc"), to_loc: s("to_loc"), from_map: s("from_map", 500), to_map: s("to_map", 500),
      ...(round ? { wait_mode: waitMode, return_loc: s("return_loc"), return_map: s("return_map", 500), return_time: s("return_time", 10) } : {}),
    };

    const remoteId = await createAmbulanceRequest(body);
    await prisma.$transaction([
      prisma.ambulanceRequest.create({
        data: { ticketId, remoteId, service, serviceDate: sd, payload: body, createdById: user.id, lastStatus: "pending", lastCheckedAt: new Date() },
      }),
      prisma.ticketEvent.create({
        data: { ticketId, actorId: user.id, action: "ambulance_sent", metadata: { remoteId, service, serviceDate: sd } },
      }),
    ]);
    revalidatePath(`/tickets/${ticketId}`);
    return { ok: true, remoteId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "حدث خطأ" };
  }
}

// تحديث حالة طلبات الإسعاف بتاعة التذكرة من نظام الإسعاف (بيتنادى من صفحة التذكرة)
export async function refreshAmbulanceStatuses(ticketId: string) {
  await requireUser();
  if (!ambulanceEnabled()) return;
  const reqs = await prisma.ambulanceRequest.findMany({ where: { ticketId } });
  await Promise.all(reqs.map(async (r) => {
    try {
      const st = await ambulanceStatus(r.remoteId);
      if (st.status) await prisma.ambulanceRequest.update({ where: { id: r.id }, data: { lastStatus: st.status, lastCheckedAt: new Date() } });
    } catch { /* نظام الإسعاف مش متاح — بنعرض آخر حالة معروفة */ }
  }));
}
