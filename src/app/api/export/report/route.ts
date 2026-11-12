import { auth } from "@/lib/auth";
import { buildReport, resolveRange } from "@/lib/reports";

export const dynamic = "force-dynamic";

function csvCell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // منع CSV injection في Excel
  return `"${s.replace(/"/g, '""')}"`;
}

// تصدير جداول التقارير (CSV بيفتح في Excel) — للمدير فقط
export async function GET(req: Request) {
  const s = await auth();
  if (!s || s.user.mustChangePassword) return new Response("unauthorized", { status: 401 });
  if (s.user.role !== "manager") return new Response("forbidden", { status: 403 });
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const range = resolveRange(q);
  const rep = await buildReport(range);
  const pct = (v: number | null) => (v == null ? "" : `${v}%`);

  let header: string[]; let rows: unknown[][];
  switch (q.kind) {
    case "users":
      header = ["الموظف", "اسم المستخدم", "الفرق", "أنشأ", "استلم", "حوّل", "تحديثات وملاحظات", "أغلق", "الإجمالي"];
      rows = rep.byUser.map((u) => [u.name, u.username, u.teams, u.created, u.received, u.transfers, u.comments, u.closed, u.total]);
      break;
    case "days":
      header = ["اليوم", "تذاكر جديدة", "تذاكر مغلقة"];
      rows = rep.days.map((d) => [d.day, d.created, d.closed]);
      break;
    case "types":
      header = ["النوع", "جديدة", "مغلقة", "الالتزام بالمهلة", "متوسط زمن الإغلاق (ساعة)"];
      rows = rep.byType.map((t) => [t.label, t.created, t.closed, pct(t.slaPct), t.avgCloseHours ?? ""]);
      break;
    default:
      header = ["الفريق", "الأعضاء", "مفتوحة الآن", "متأخرة الآن", "لم تُستلم", "أغلقت في الفترة", "الالتزام بالمهلة", "متوسط زمن الإغلاق (ساعة)"];
      rows = rep.byTeam.map((t) => [t.name, t.members, t.open, t.breached, t.unreceived, t.closed, pct(t.slaPct), t.avgCloseHours ?? ""]);
  }
  const body = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${q.kind ?? "teams"}-${range.fromYmd}_${range.toYmd}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
