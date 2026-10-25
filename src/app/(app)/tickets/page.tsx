import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/access";
import { buildTicketWhere, type TicketFilters } from "@/lib/ticket-filters";
import { SOURCE_LABELS, TYPE_LABELS, slaState } from "@/lib/workflow";
import { SlaBadge, StatusBadge, TeamChip, TypeBadge } from "@/components/ui/badge";
import { SlaCountdown } from "@/components/tickets/sla-countdown";
import { Input, Select } from "@/components/ui/form";
import { displayName, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function TicketsPage({ searchParams }: { searchParams: Promise<TicketFilters> }) {
  const f = await searchParams;
  const s = await auth();
  if (!s) redirect("/login");
  const { user } = s;

  const where = buildTicketWhere(user, f);
  const page = Math.max(1, Number(f.page) || 1);
  const [total, tickets, teams] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy: (f.status ?? "pending") === "pending" ? { slaDeadline: "asc" } : { closedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        teams: { include: { team: true } },
        assignedTo: { select: { fullName: true } },
        _count: { select: { attachments: true, comments: true } },
      },
    }),
    prisma.team.findMany({
      where: { isActive: true, ...(isManager(user) ? {} : { id: { in: user.teamIds } }) },
      orderBy: { name: "asc" },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const now = new Date();
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...f, ...extra }).filter(([, v]) => v) as [string, string][]);
    return p.toString();
  };
  const canExport = isManager(user) || user.canExport;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">التذاكر</h1>
          <p className="mt-1 text-sm text-slate-500">{total} تذكرة</p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <a href={`/api/export/tickets?${qs({})}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              ⬇️ تصدير Excel
            </a>
          )}
          {user.role !== "viewer" && (
            <Link href="/tickets/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
              + تذكرة جديدة
            </Link>
          )}
        </div>
      </div>

      <form className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-7" method="get">
        <Input name="q" defaultValue={f.q ?? ""} placeholder="بحث: الاسم، الهاتف، الكود، الرقم القومي..." className="col-span-2" />
        <Select name="status" defaultValue={f.status ?? "pending"}>
          <option value="pending">قيد التنفيذ</option>
          <option value="closed">مغلقة</option>
          <option value="all">الكل</option>
        </Select>
        <Select name="type" defaultValue={f.type ?? ""}>
          <option value="">جميع الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select name="source" defaultValue={f.source ?? ""}>
          <option value="">جميع المصادر</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select name="teamId" defaultValue={f.teamId ?? ""}>
          <option value="">جميع الفرق</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <div className="flex gap-2">
          <button className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900">تصفية</button>
          <Link href="/tickets" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">مسح</Link>
        </div>
        {f.sla === "breached" && <input type="hidden" name="sla" value="breached" />}
        {f.mine === "1" && <input type="hidden" name="mine" value="1" />}
      </form>

      <div className="card overflow-x-auto">
        <table className="data-table min-w-[900px]">
          <thead>
            <tr><th>التذكرة</th><th>النوع</th><th>المصدر</th><th>لدى فريق</th><th>المسؤول</th><th>الحالة</th><th>المهلة</th><th>تاريخ الإنشاء</th></tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/tickets/${t.id}`} className="font-medium text-brand-700 hover:underline">{t.beneficiaryName}</Link>
                  <div className="font-mono text-xs text-slate-400">
                    {t.ticketNumber}{t._count.attachments > 0 && ` · 📎${t._count.attachments}`}{t._count.comments > 0 && ` · 💬${t._count.comments}`}
                  </div>
                </td>
                <td><TypeBadge type={t.type} /></td>
                <td className="text-xs text-slate-600">{SOURCE_LABELS[t.source]}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {t.teams.filter((x) => x.access === "holder").map((x) => <TeamChip key={x.teamId} name={x.team.name} color={x.team.color} />)}
                  </div>
                </td>
                <td className="text-xs text-slate-600">{t.assignedTo ? displayName(t.assignedTo.fullName) : "—"}</td>
                <td><StatusBadge status={t.status} /></td>
                <td>
                  <div className="flex flex-col gap-1">
                    <SlaBadge state={slaState(t, now)} />
                    {t.status === "pending" && <SlaCountdown deadline={t.slaDeadline.toISOString()} />}
                  </div>
                </td>
                <td className="text-xs text-slate-500">{formatDateTime(t.createdAt)}</td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-slate-400">لا توجد تذاكر مطابقة لمعايير البحث</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {page > 1 && <Link className="rounded border bg-white px-3 py-1" href={`/tickets?${qs({ page: String(page - 1) })}`}>السابق</Link>}
          <span className="text-slate-500">صفحة {page} من {pages}</span>
          {page < pages && <Link className="rounded border bg-white px-3 py-1" href={`/tickets?${qs({ page: String(page + 1) })}`}>التالي</Link>}
        </div>
      )}
    </div>
  );
}
