import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTicketWhere, type TicketFilters } from "@/lib/ticket-filters";
import { SOURCE_LABELS, TYPE_LABELS, TRIAGE_LABELS, slaState } from "@/lib/workflow";

export const dynamic = "force-dynamic";

const SLA_AR = { within: "ضمن الوقت", warning: "قارب على الانتهاء", breached: "متأخر", met: "في الوقت" };

function csvCell(v: unknown) {
  let s = v == null ? "" : String(v);
  // منع CSV injection في Excel
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const s = await auth();
  if (!s) return new Response("unauthorized", { status: 401 });
  if (s.user.role !== "manager" && !s.user.canExport) return new Response("forbidden", { status: 403 });

  const f = Object.fromEntries(new URL(req.url).searchParams) as TicketFilters;
  const rows = await prisma.ticket.findMany({
    where: buildTicketWhere(s.user, f),
    orderBy: { createdAt: "desc" },
    take: 10_000,
    include: {
      teams: { where: { access: "holder" }, include: { team: { select: { name: true } } } },
      createdBy: { select: { fullName: true } },
      assignedTo: { select: { fullName: true } },
    },
  });

  const header = ["رقم التذكرة", "النوع", "المصدر", "الحالة", "SLA", "الاسم", "الهاتف الأول", "الهاتف الثاني", "الكود",
    "صلة القرابة", "الجنسية", "الرقم القومي", "رقم المفوضية", "الفريق", "المسؤول", "تصنيف الطبيب",
    "قرار الأبحاث", "أنشأها", "تاريخ الإنشاء", "موعد SLA", "تاريخ الإغلاق", "سبب الإغلاق"];
  const lines = rows.map((t) => [
    t.ticketNumber, TYPE_LABELS[t.type], SOURCE_LABELS[t.source], t.status === "pending" ? "قيد التنفيذ" : "مغلقة",
    SLA_AR[slaState(t)], t.beneficiaryName, t.phone1, t.phone2, t.caseCode, t.relationship, t.nationality,
    t.nationalId, t.unhcrNumber, t.teams.map((x) => x.team.name).join(" + "), t.assignedTo?.fullName,
    t.triageLevel ? TRIAGE_LABELS[t.triageLevel] : "", t.researchDecision ?? "", t.createdBy.fullName,
    t.createdAt.toISOString(), t.slaDeadline.toISOString(), t.closedAt?.toISOString(), t.closeReason,
  ].map(csvCell).join(","));

  const body = "﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tickets-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
