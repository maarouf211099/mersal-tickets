import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager, ticketScope } from "@/lib/access";
import { TYPE_LABELS, slaLabel, slaState, type TicketType } from "@/lib/workflow";
import { SlaBadge, TeamChip, TypeBadge } from "@/components/ui/badge";
import { SlaCountdown } from "@/components/tickets/sla-countdown";
import { CountUp } from "@/components/ui/count-up";
import { AlarmIcon, ArrowLeftIcon, CheckCircleIcon, ClockIcon, InboxIcon, PlusIcon, UserCheckIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const s = await auth();
  if (!s) redirect("/login");
  const { user } = s;
  const scope = ticketScope(user);
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [byType, breached, closedToday, mine, urgent, teams] = await Promise.all([
    prisma.ticket.groupBy({ by: ["type"], where: { AND: [scope, { status: "pending" }] }, _count: true }),
    prisma.ticket.count({ where: { AND: [scope, { status: "pending", slaDeadline: { lt: now } }] } }),
    prisma.ticket.count({ where: { AND: [scope, { status: "closed", closedAt: { gte: startOfDay } }] } }),
    prisma.ticket.count({ where: { AND: [scope, { status: "pending", assignedToId: user.id }] } }),
    prisma.ticket.findMany({
      where: { AND: [scope, { status: "pending" }] },
      orderBy: { slaDeadline: "asc" },
      take: 10,
      include: { teams: { where: { access: "holder" }, include: { team: true } } },
    }),
    prisma.team.findMany({
      where: { isActive: true, ...(isManager(user) ? {} : { id: { in: user.teamIds } }) },
      orderBy: { name: "asc" },
      include: { _count: { select: { tickets: { where: { access: "holder", ticket: { status: "pending" } } } } } },
    }),
  ]);

  const count = (t: TicketType) => byType.find((x) => x.type === t)?._count ?? 0;
  const totalPending = byType.reduce((a, x) => a + x._count, 0);
  const sortedTeams = [...teams].sort((a, b) => b._count.tickets - a._count.tickets);
  const maxTeam = Math.max(1, ...teams.map((t) => t._count.tickets));
  const today = new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);

  return (
    <div className="space-y-6">
      <div className="animate-gradient relative overflow-hidden rounded-2xl bg-gradient-to-l from-brand-700 via-brand-600 to-brand-500 p-6 text-white shadow-lg shadow-brand-900/10">
        <div aria-hidden className="pointer-events-none absolute -left-10 -top-16 h-48 w-48 animate-float rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 left-32 h-40 w-40 animate-float-slow rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-brand-100">{today}</p>
            <h1 className="mt-1 text-2xl font-bold">مرحبًا، {user.name} 👋</h1>
            <p className="mt-1 text-sm text-brand-50/90">
              {totalPending === 0 ? "لا توجد تذاكر مفتوحة الآن" : `لديك ${totalPending} تذكرة قيد التنفيذ`}
              {breached > 0 && <span className="font-semibold text-accent-200"> — منها {breached} تجاوزت المهلة</span>}
            </p>
          </div>
          <Link href="/tickets/new" className="group inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-50 hover:shadow-md active:scale-[0.97]">
            <PlusIcon className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" /> تذكرة جديدة
          </Link>
        </div>
      </div>

      <div className="stagger grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="قيد التنفيذ" value={totalPending} href="/tickets" icon={InboxIcon} tone="brand" />
        <Stat label="متجاوزة لمهلة الإنجاز" value={breached} href="/tickets?sla=breached" icon={AlarmIcon} tone="red" />
        <Stat label="مسندة إليّ" value={mine} href="/tickets?mine=1" icon={UserCheckIcon} tone="violet" />
        <Stat label="أُغلقت اليوم" value={closedToday} href="/tickets?status=closed" icon={CheckCircleIcon} tone="emerald" />
      </div>

      <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-3">
        {(["emergency", "new_case", "follow_up"] as const).map((t) => {
          const n = count(t);
          const pct = totalPending ? Math.round((n / totalPending) * 100) : 0;
          return (
            <Link key={t} href={`/tickets?type=${t}`} className={`card card-hover group border-t-4 p-4 ${TYPE_STYLE[t].border}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-transform duration-300 group-hover:scale-110 ${TYPE_STYLE[t].tile}`}>
                    <span className={t === "emergency" && n > 0 ? "animate-wiggle inline-block" : undefined}>{TYPE_STYLE[t].icon}</span>
                  </span>
                  <div>
                    <div className="font-semibold text-slate-800">{TYPE_LABELS[t]}</div>
                    <div className="text-xs text-slate-500">مهلة الإنجاز: {slaLabel(t)}</div>
                  </div>
                </div>
                <span className="text-3xl font-bold text-slate-900"><CountUp value={n} /></span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`bar-grow h-full rounded-full ${TYPE_STYLE[t].bar}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 text-xs text-slate-400">{pct}% من التذاكر المفتوحة</div>
            </Link>
          );
        })}
      </div>

      <div className="stagger grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><ClockIcon className="h-4 w-4" /></span>
              الأقرب إلى انتهاء مهلة الإنجاز
            </h2>
            <Link href="/tickets" className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
              كل التذاكر <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </div>
          {urgent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="text-4xl">🎉</span>
              <p className="text-sm text-slate-500">لا توجد تذاكر مفتوحة</p>
            </div>
          ) : (
            <div className="overflow-x-auto"><table className="data-table rows-in min-w-[560px]">
              <thead><tr><th>التذكرة</th><th>النوع</th><th>الفريق</th><th>المهلة</th></tr></thead>
              <tbody>
                {urgent.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/tickets/${t.id}`} className="font-medium text-brand-700 hover:underline">{t.beneficiaryName}</Link>
                      <div className="font-mono text-xs text-slate-400">{t.ticketNumber}</div>
                    </td>
                    <td><TypeBadge type={t.type} /></td>
                    <td className="space-x-1 space-x-reverse">{t.teams.map((x) => <TeamChip key={x.teamId} name={x.team.name} color={x.team.color} />)}</td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <SlaBadge state={slaState(t, now)} />
                        <SlaCountdown deadline={t.slaDeadline.toISOString()} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><InboxIcon className="h-4 w-4" /></span>
            أعمال الفرق
          </h2>
          <ul className="stagger space-y-1">
            {sortedTeams.map((t) => {
              const n = t._count.tickets;
              return (
                <li key={t.id}>
                  <Link href={`/tickets?teamId=${t.id}`} className={`block rounded-lg px-2 py-2 hover:bg-slate-50 ${n === 0 ? "opacity-60" : ""}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium text-slate-700">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                        {t.name}
                      </span>
                      <span className="font-semibold text-slate-900">{n}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="bar-grow h-full rounded-full" style={{ width: `${(n / maxTeam) * 100}%`, background: t.color }} />
                    </div>
                  </Link>
                </li>
              );
            })}
            {teams.length === 0 && <li className="text-sm text-slate-400">لست عضوًا في أي فريق — تواصل مع المدير</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

const TYPE_STYLE: Record<TicketType, { icon: string; tile: string; bar: string; border: string }> = {
  emergency: { icon: "🚨", tile: "bg-red-50", bar: "bg-red-500", border: "border-t-red-500" },
  new_case: { icon: "🆕", tile: "bg-violet-50", bar: "bg-violet-500", border: "border-t-violet-500" },
  follow_up: { icon: "📋", tile: "bg-brand-50", bar: "bg-brand-500", border: "border-t-brand-500" },
};

const TONES = {
  brand: { tile: "bg-brand-50 text-brand-600", value: "text-slate-900" },
  red: { tile: "bg-red-50 text-red-600", value: "text-red-600" },
  violet: { tile: "bg-violet-50 text-violet-600", value: "text-slate-900" },
  emerald: { tile: "bg-emerald-50 text-emerald-600", value: "text-emerald-600" },
};

function Stat({ label, value, href, icon: Icon, tone }: {
  label: string; value: number; href: string; icon: (p: { className?: string }) => React.ReactNode; tone: keyof typeof TONES;
}) {
  const t = TONES[tone];
  const valueCls = tone === "red" && value === 0 ? "text-slate-900" : t.value;
  return (
    <Link href={href} className="card card-hover group flex items-center gap-4 p-4">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${t.tile}`}><Icon className="h-6 w-6" /></span>
      <div className="min-w-0">
        <div className={`text-2xl font-bold leading-tight ${valueCls}`}><CountUp value={value} /></div>
        <div className="truncate text-xs text-slate-500">{label}</div>
      </div>
    </Link>
  );
}
