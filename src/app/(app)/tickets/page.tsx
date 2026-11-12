import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/access";
import { buildTicketWhere, type TicketFilters } from "@/lib/ticket-filters";
import { SOURCE_LABELS, TYPE_LABELS, slaState, type TicketType } from "@/lib/workflow";
import { SlaBadge, StatusBadge, TeamChip, TypeBadge } from "@/components/ui/badge";
import { SlaCountdown } from "@/components/tickets/sla-countdown";
import { Input, Select } from "@/components/ui/form";
import { displayName, formatDateTime } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function TicketsPage({ searchParams }: { searchParams: Promise<TicketFilters> }) {
  const f = await searchParams;
  const s = await auth();
  if (!s) redirect("/login");
  const { user } = s;

  const where = buildTicketWhere(user, f);
  const sortKey = f.sort && f.sort in SORT_FIELDS ? (f.sort as SortKey) : null;
  const sortDir: "asc" | "desc" = f.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(f.page) || 1);
  // عدّاد كل تبويب حالة — بنفس باقي الفلاتر
  const tabWhere = (status: string, sla?: string) => buildTicketWhere(user, { ...f, status, sla });
  const [total, tickets, teams, cAll, cPending, cBreached, cClosed] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy: sortKey
        ? [{ [SORT_FIELDS[sortKey]]: sortDir }, { createdAt: "desc" }]
        // الافتراضي — الكل: المفتوحة الأول (الأقرب لانتهاء المهلة)، وبعدها المغلقة الأحدث فالأقدم
        : f.status === "pending" ? [{ slaDeadline: "asc" }]
        : f.status === "closed" ? [{ closedAt: "desc" }]
        : [{ status: "asc" }, { closedAt: { sort: "desc", nulls: "first" } }, { slaDeadline: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        teams: { include: { team: true } },
        assignedTo: { select: { fullName: true } },
        createdBy: { select: { fullName: true } },
        _count: { select: { attachments: true, comments: true } },
      },
    }),
    prisma.team.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.ticket.count({ where: tabWhere("all") }),
    prisma.ticket.count({ where: tabWhere("pending") }),
    prisma.ticket.count({ where: tabWhere("pending", "breached") }),
    prisma.ticket.count({ where: tabWhere("closed") }),
  ]);
  const curStatus = f.status ?? "all";
  const TABS = [
    { key: "all", label: "الكل", count: cAll, active: curStatus === "all" && f.sla !== "breached", href: { status: "all", sla: "" } },
    { key: "pending", label: "قيد التنفيذ", count: cPending, active: curStatus === "pending" && f.sla !== "breached", href: { status: "pending", sla: "" } },
    { key: "breached", label: "متأخرة", count: cBreached, active: f.sla === "breached", href: { status: "pending", sla: "breached" } },
    { key: "closed", label: "مغلقة", count: cClosed, active: curStatus === "closed", href: { status: "closed", sla: "" } },
  ];
  const activeFilters = [f.q, f.type, f.source, f.teamId, f.period, f.mine].filter(Boolean).length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const now = new Date();
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...f, ...extra }).filter(([, v]) => v) as [string, string][]);
    return p.toString();
  };
  const canExport = isManager(user) || user.canExport;

  // عنوان عمود قابل للترتيب: أول ضغطة بالترتيب الافتراضي للعمود، والضغطة التانية بتعكسه
  function SortTh({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    const next = active ? (sortDir === "asc" ? "desc" : "asc") : DEFAULT_DIR[k];
    const title = k === "created" || k === "deadline"
      ? (next === "desc" ? "من الأحدث للأقدم" : "من الأقدم للأحدث")
      : (next === "asc" ? "تصاعدي" : "تنازلي");
    return (
      <th aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
        <Link href={`/tickets?${qs({ sort: k, dir: next, page: "" })}`} title={`ترتيب: ${title}`}
          className={`group/sort inline-flex items-center gap-1 rounded-md px-1 py-0.5 -mx-1 transition-colors hover:bg-slate-200/60 hover:text-slate-900 ${active ? "text-brand-700" : ""}`}>
          {label}
          <span className={`flex flex-col leading-none ${active ? "" : "opacity-30 group-hover/sort:opacity-70"}`} aria-hidden>
            <svg viewBox="0 0 10 6" className={`h-1.5 w-2.5 ${active && sortDir === "asc" ? "text-brand-600" : active ? "text-slate-300" : ""}`} fill="currentColor"><path d="M5 0l5 6H0z" /></svg>
            <svg viewBox="0 0 10 6" className={`mt-0.5 h-1.5 w-2.5 ${active && sortDir === "desc" ? "text-brand-600" : active ? "text-slate-300" : ""}`} fill="currentColor"><path d="M5 6L0 0h10z" /></svg>
          </span>
        </Link>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader icon="🎫" title="التذاكر" subtitle={`${total} تذكرة`}>
        {canExport && (
          <a href={`/api/export/tickets?${qs({})}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50">
            ⬇️ تصدير Excel
          </a>
        )}
        {user.role !== "viewer" && (
          <Link href="/tickets/new" className="group hidden items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700 active:scale-[0.97] lg:inline-flex">
            <span className="text-base leading-none transition-transform duration-300 group-hover:rotate-90">+</span> تذكرة جديدة
          </Link>
        )}
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/tickets?${qs({ ...t.href, page: "" })}`}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${t.active
              ? (t.key === "breached" ? "bg-red-600 text-white shadow-md shadow-red-600/20" : "bg-brand-600 text-white shadow-md shadow-brand-600/20")
              : "bg-white text-slate-600 ring-1 ring-slate-200 hover:-translate-y-0.5 hover:text-slate-900 hover:shadow-sm"}`}>
            {t.key === "breached" && <span className={`h-2 w-2 rounded-full ${t.active ? "bg-white" : "pulse-red bg-red-500"}`} />}
            {t.label}
            <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${t.active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{t.count}</span>
          </Link>
        ))}
      </div>

      <form className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-4 xl:grid-cols-7" method="get">
        <div className="relative col-span-2">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <Input name="q" defaultValue={f.q ?? ""} placeholder="بحث: الاسم، الهاتف، الكود، الرقم القومي..." className="pr-9" />
        </div>
        <input type="hidden" name="status" value={curStatus} />
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
          {!isManager(user) && <option value="mine">تذاكر فرقي</option>}
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Select name="period" defaultValue={f.period ?? ""}>
          <option value="">كل الأوقات</option>
          <option value="today">اليوم</option>
          <option value="7d">آخر 7 أيام</option>
          <option value="30d">آخر 30 يوم</option>
        </Select>
        <div className="flex gap-2">
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.97]">
            تصفية
            {activeFilters > 0 && <span className="rounded-full bg-white/25 px-1.5 text-xs">{activeFilters}</span>}
          </button>
          {activeFilters > 0 && <Link href={`/tickets?${qs({ q: "", type: "", source: "", teamId: "", period: "", mine: "", page: "" })}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50">مسح</Link>}
        </div>
        {f.sla === "breached" && <input type="hidden" name="sla" value="breached" />}
        {f.mine === "1" && <input type="hidden" name="mine" value="1" />}
        {sortKey && <input type="hidden" name="sort" value={sortKey} />}
        {sortKey && <input type="hidden" name="dir" value={sortDir} />}
      </form>

      {/* الموبايل: كروت بدل الجدول */}
      <div className="flex flex-wrap gap-2 text-xs md:hidden">
        {[["الأحدث أولًا", "created", "desc"], ["الأقدم أولًا", "created", "asc"], ["الأقرب للمهلة", "deadline", "asc"]].map(([label, k, d]) => (
          <Link key={label} href={`/tickets?${qs({ sort: k, dir: d, page: "" })}`}
            className={`rounded-full px-3 py-1.5 font-medium ${sortKey === k && sortDir === d ? "bg-slate-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{label}</Link>
        ))}
      </div>
      <div className="stagger space-y-3 md:hidden">
        {tickets.map((t) => {
          const sla = slaState(t, now);
          return (
            <Link key={t.id} href={`/tickets/${t.id}`}
              className={`card block border-r-4 p-4 transition active:scale-[0.99] ${TYPE_STRIPE[t.type]} ${t.status === "pending" && sla === "breached" ? "bg-red-50/60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{t.beneficiaryName}</div>
                  <div className="font-mono text-xs text-slate-400">
                    {t.ticketNumber}{t._count.comments > 0 && ` · 💬${t._count.comments}`}{t._count.attachments > 0 && ` · 📎${t._count.attachments}`}
                  </div>
                </div>
                <TypeBadge type={t.type} />
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {t.teams.filter((x) => x.access === "holder").map((x) => <TeamChip key={x.teamId} name={x.team.name} color={x.team.color} />)}
                <StatusBadge status={t.status} />
                <SlaBadge state={sla} />
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Avatar name={t.createdBy.fullName} size="xs" />
                  <span className="truncate">{displayName(t.createdBy.fullName)} · {formatDateTime(t.createdAt)}</span>
                </span>
                {t.status === "pending" && <SlaCountdown deadline={t.slaDeadline.toISOString()} />}
              </div>
            </Link>
          );
        })}
        {tickets.length === 0 && (
          <div className="card py-14 text-center"><div className="text-4xl">🔍</div><p className="mt-2 text-sm text-slate-500">لا توجد تذاكر مطابقة لمعايير البحث</p></div>
        )}
      </div>

      <div className="card hidden overflow-x-auto md:block">
        <table className="data-table rows-in min-w-[900px]">
          <thead>
            <tr>
              <SortTh k="name" label="التذكرة" />
              <SortTh k="type" label="النوع" />
              <SortTh k="source" label="المصدر" />
              <th>لدى فريق</th>
              <th>المسؤول</th>
              <SortTh k="status" label="الحالة" />
              <SortTh k="deadline" label="المهلة" />
              <SortTh k="created" label="أنشأها / التاريخ" />
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => {
              const sla = slaState(t, now);
              return (
              <tr key={t.id} className={`group relative cursor-pointer ${t.status === "pending" && sla === "breached" ? "bg-red-50/50" : ""}`}>
                <td className={`border-r-4 ${TYPE_STRIPE[t.type]}`}>
                  <Link href={`/tickets/${t.id}`} className="font-medium text-brand-700 after:absolute after:inset-0 group-hover:underline">{t.beneficiaryName}</Link>
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
                <td className="text-xs text-slate-600">
                  {t.assignedTo ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={t.assignedTo.fullName} size="xs" />
                      {displayName(t.assignedTo.fullName)}
                    </span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td><StatusBadge status={t.status} /></td>
                <td>
                  <div className="flex w-36 flex-col gap-1">
                    <SlaBadge state={sla} />
                    {t.status === "pending" && (
                      <>
                        <SlaCountdown deadline={t.slaDeadline.toISOString()} />
                        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100" title="الوقت المستهلك من المهلة">
                          <div className={`bar-grow h-full rounded-full ${SLA_BAR[sla]}`} style={{ width: `${slaUsed(t.createdAt, t.slaDeadline, now)}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                    <Avatar name={t.createdBy.fullName} size="xs" />
                    {displayName(t.createdBy.fullName)}
                  </span>
                  <div className="mt-0.5 text-slate-400">{formatDateTime(t.createdAt)}</div>
                </td>
              </tr>
              );
            })}
            {tickets.length === 0 && (
              <tr><td colSpan={8} className="py-16 text-center">
                <div className="text-4xl">🔍</div>
                <p className="mt-2 text-sm text-slate-500">لا توجد تذاكر مطابقة لمعايير البحث</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-1.5 text-sm" aria-label="الصفحات">
          {page > 1 && <Link className={PAGE_BTN} href={`/tickets?${qs({ page: String(page - 1) })}`}>→ السابق</Link>}
          {pageList(page, pages).map((n, i) => n === 0
            ? <span key={`g${i}`} className="px-1 text-slate-400">…</span>
            : <Link key={n} href={`/tickets?${qs({ page: String(n) })}`} aria-current={n === page ? "page" : undefined}
                className={n === page ? "min-w-9 rounded-lg bg-brand-600 px-3 py-1.5 text-center font-semibold text-white shadow-sm" : `min-w-9 text-center ${PAGE_BTN}`}>{n}</Link>)}
          {page < pages && <Link className={PAGE_BTN} href={`/tickets?${qs({ page: String(page + 1) })}`}>التالي ←</Link>}
        </nav>
      )}
    </div>
  );
}

const PAGE_BTN = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50";

// أرقام الصفحات: الأولى والأخيرة وحوالين الحالية، و0 = "…"
function pageList(cur: number, total: number): number[] {
  const set = new Set([1, total, cur - 1, cur, cur + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: number[] = [];
  sorted.forEach((n, i) => { if (i && n - sorted[i - 1] > 1) out.push(0); out.push(n); });
  return out;
}

// نسبة الوقت اللي اتصرف من المهلة
function slaUsed(createdAt: Date, deadline: Date, now: Date) {
  const total = deadline.getTime() - createdAt.getTime();
  if (total <= 0) return 100;
  return Math.min(100, Math.max(2, ((now.getTime() - createdAt.getTime()) / total) * 100));
}

const SLA_BAR: Record<string, string> = {
  within: "bg-emerald-500", warning: "bg-amber-500", breached: "bg-red-500", met: "bg-slate-400",
};

const TYPE_STRIPE: Record<TicketType, string> = {
  emergency: "border-r-red-500",
  new_case: "border-r-violet-400",
  follow_up: "border-r-brand-400",
};

const SORT_FIELDS = {
  name: "beneficiaryName", type: "type", source: "source",
  status: "status", deadline: "slaDeadline", created: "createdAt",
} as const;
type SortKey = keyof typeof SORT_FIELDS;
// التاريخ: الأحدث الأول — الباقي: أبجدي/تصاعدي
const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = {
  name: "asc", type: "asc", source: "asc", status: "asc", deadline: "asc", created: "desc",
};
