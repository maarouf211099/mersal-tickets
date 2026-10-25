import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager, ticketScope } from "@/lib/access";
import { TYPE_LABELS, slaState, type TicketType } from "@/lib/workflow";
import { SlaBadge, TeamChip, TypeBadge } from "@/components/ui/badge";
import { SlaCountdown } from "@/components/tickets/sla-countdown";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">أهلاً {user.name}</h1>
        <p className="mt-1 text-sm text-slate-500">ملخص التيكتات اللي تخص تيمك</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="قيد التنفيذ" value={totalPending} href="/tickets" />
        <Stat label="متأخرة عن الـ SLA" value={breached} href="/tickets?sla=breached" tone="red" />
        <Stat label="مسندة ليا" value={mine} href="/tickets?mine=1" />
        <Stat label="اتقفلت النهارده" value={closedToday} href="/tickets?status=closed" tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(["emergency", "new_case", "follow_up"] as const).map((t) => (
          <Link key={t} href={`/tickets?type=${t}`} className="card card-hover flex items-center justify-between p-4">
            <TypeBadge type={t} />
            <span className="text-2xl font-bold text-slate-900">{count(t)}</span>
            <span className="sr-only">{TYPE_LABELS[t]}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold text-slate-900">الأقرب لانتهاء الـ SLA</h2>
          {urgent.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">مفيش تيكتات مفتوحة 🎉</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>التيكت</th><th>الحالة</th><th>التيم</th><th>SLA</th></tr></thead>
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
                      <div className="flex flex-col gap-1">
                        <SlaBadge state={slaState(t, now)} />
                        <SlaCountdown deadline={t.slaDeadline.toISOString()} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-slate-900">شغل التيمات</h2>
          <ul className="space-y-2">
            {teams.map((t) => (
              <li key={t.id}>
                <Link href={`/tickets?teamId=${t.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <TeamChip name={t.name} color={t.color} />
                  <span className="text-sm font-semibold text-slate-700">{t._count.tickets}</span>
                </Link>
              </li>
            ))}
            {teams.length === 0 && <li className="text-sm text-slate-400">انت مش في أي تيم — كلّم المدير</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, href, tone }: { label: string; value: number; href: string; tone?: "red" | "emerald" }) {
  const color = tone === "red" && value > 0 ? "text-red-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-900";
  return (
    <Link href={href} className="card card-hover p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${color}`}>{value}</div>
    </Link>
  );
}
