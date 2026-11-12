import "server-only";
import { prisma } from "./prisma";
import { SOURCE_LABELS, TYPE_LABELS, type TicketSource, type TicketType } from "./workflow";

const CAIRO = "Africa/Cairo";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: CAIRO }).format(d);
const cairoMidnight = (ymd: string) => new Date(`${ymd}T00:00:00+02:00`);

export type Range = { from: Date; to: Date; fromYmd: string; toYmd: string; label: string };

// الفترة: preset (today/7d/30d/month/all) أو from/to (YYYY-MM-DD) — الافتراضي آخر 30 يوم
export function resolveRange(q: { preset?: string; from?: string; to?: string }): Range {
  const today = dayKey(new Date());
  const ok = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  let fromYmd = today, toYmd = today, label = "";
  if (ok(q.from) && ok(q.to)) { fromYmd = q.from! <= q.to! ? q.from! : q.to!; toYmd = q.from! <= q.to! ? q.to! : q.from!; label = `من ${fromYmd} إلى ${toYmd}`; }
  else {
    const back = (n: number) => dayKey(new Date(cairoMidnight(today).getTime() - n * 86_400_000 + 3_600_000));
    switch (q.preset) {
      case "today": label = "اليوم"; break;
      case "7d": fromYmd = back(6); label = "آخر 7 أيام"; break;
      case "month": fromYmd = today.slice(0, 8) + "01"; label = "هذا الشهر"; break;
      case "all": fromYmd = "2020-01-01"; label = "كل الفترات"; break;
      default: fromYmd = back(29); label = "آخر 30 يومًا";
    }
  }
  return { from: cairoMidnight(fromYmd), to: new Date(cairoMidnight(toYmd).getTime() + 86_400_000), fromYmd, toYmd, label };
}

const hours = (ms: number) => Math.round((ms / 3_600_000) * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export async function buildReport(r: Range) {
  const inRange = { gte: r.from, lt: r.to };
  const now = new Date();
  const [created, closed, openNow, teams, users, comments, events, ambulance, logins, failedLogins] = await Promise.all([
    prisma.ticket.findMany({ where: { createdAt: inRange }, select: { type: true, source: true, createdAt: true, createdById: true } }),
    prisma.ticket.findMany({
      where: { status: "closed", closedAt: inRange },
      select: { type: true, createdAt: true, closedAt: true, slaDeadline: true, closeCategory: true, closedById: true, teams: { where: { access: "holder" }, select: { teamId: true } } },
    }),
    prisma.ticket.findMany({
      where: { status: "pending" },
      select: { type: true, slaDeadline: true, receivedAt: true, assignedToId: true, teams: { where: { access: "holder" }, select: { teamId: true } } },
    }),
    prisma.team.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true, _count: { select: { members: true } } } }),
    prisma.user.findMany({ select: { id: true, fullName: true, username: true, isActive: true, teams: { select: { team: { select: { name: true } } } } } }),
    prisma.ticketComment.groupBy({ by: ["authorId"], where: { createdAt: inRange }, _count: true }),
    prisma.ticketEvent.groupBy({ by: ["actorId", "action"], where: { createdAt: inRange, action: { in: ["transferred", "received"] }, actorId: { not: null } }, _count: true }),
    prisma.ambulanceRequest.count({ where: { createdAt: inRange } }),
    prisma.systemEvent.count({ where: { createdAt: inRange, action: "login" } }),
    prisma.systemEvent.count({ where: { createdAt: inRange, action: "login_failed" } }),
  ]);

  // ── أرقام عامة
  const closedOnTime = closed.filter((t) => t.closedAt! <= t.slaDeadline).length;
  const kpi = {
    created: created.length, closed: closed.length, openNow: openNow.length,
    breachedNow: openNow.filter((t) => t.slaDeadline < now).length,
    unreceivedNow: openNow.filter((t) => !t.receivedAt).length,
    unassignedNow: openNow.filter((t) => !t.assignedToId).length,
    slaPct: closed.length ? Math.round((closedOnTime / closed.length) * 100) : null,
    avgCloseHours: closed.length ? hours(avg(closed.map((t) => t.closedAt!.getTime() - t.createdAt.getTime()))) : null,
    ambulance, logins, failedLogins,
  };

  // ── يوم بيوم (بحد أقصى آخر 60 يوم من الفترة)
  const days: { day: string; created: number; closed: number }[] = [];
  const startMs = Math.max(r.from.getTime(), r.to.getTime() - 60 * 86_400_000);
  for (let t = startMs; t < r.to.getTime(); t += 86_400_000) days.push({ day: dayKey(new Date(t + 3_600_000)), created: 0, closed: 0 });
  const idx = new Map(days.map((d, i) => [d.day, i]));
  for (const t of created) { const i = idx.get(dayKey(t.createdAt)); if (i !== undefined) days[i].created++; }
  for (const t of closed) { const i = idx.get(dayKey(t.closedAt!)); if (i !== undefined) days[i].closed++; }

  // ── بالنوع والمصدر وسبب الإغلاق
  const tally = <K extends string>(keys: K[]) => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  const typeKeys = Object.keys(TYPE_LABELS) as TicketType[];
  const byTypeCreated = tally(typeKeys), byTypeClosed = tally(typeKeys), byTypeOnTime = tally(typeKeys);
  const typeCloseMs: Record<string, number[]> = {};
  for (const t of created) byTypeCreated[t.type]++;
  for (const t of closed) {
    byTypeClosed[t.type]++;
    if (t.closedAt! <= t.slaDeadline) byTypeOnTime[t.type]++;
    (typeCloseMs[t.type] ??= []).push(t.closedAt!.getTime() - t.createdAt.getTime());
  }
  const byType = typeKeys.map((k) => ({
    key: k, label: TYPE_LABELS[k], created: byTypeCreated[k], closed: byTypeClosed[k],
    slaPct: byTypeClosed[k] ? Math.round((byTypeOnTime[k] / byTypeClosed[k]) * 100) : null,
    avgCloseHours: typeCloseMs[k]?.length ? hours(avg(typeCloseMs[k])) : null,
  }));
  const srcKeys = Object.keys(SOURCE_LABELS) as TicketSource[];
  const srcCount = tally(srcKeys);
  for (const t of created) srcCount[t.source]++;
  const bySource = srcKeys.map((k) => ({ label: SOURCE_LABELS[k], count: srcCount[k] })).sort((a, b) => b.count - a.count);
  const catCount = new Map<string, number>();
  for (const t of closed) catCount.set(t.closeCategory ?? "بدون سبب محدد", (catCount.get(t.closeCategory ?? "بدون سبب محدد") ?? 0) + 1);
  const byCloseCategory = [...catCount].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  // ── بالفريق
  const byTeam = teams.map((tm) => {
    const open = openNow.filter((t) => t.teams.some((x) => x.teamId === tm.id));
    const cl = closed.filter((t) => t.teams.some((x) => x.teamId === tm.id));
    return {
      id: tm.id, name: tm.name, color: tm.color, members: tm._count.members,
      open: open.length, breached: open.filter((t) => t.slaDeadline < now).length, unreceived: open.filter((t) => !t.receivedAt).length,
      closed: cl.length, slaPct: cl.length ? Math.round((cl.filter((t) => t.closedAt! <= t.slaDeadline).length / cl.length) * 100) : null,
      avgCloseHours: cl.length ? hours(avg(cl.map((t) => t.closedAt!.getTime() - t.createdAt.getTime()))) : null,
    };
  }).sort((a, b) => b.open + b.closed - (a.open + a.closed));

  // ── بالموظف
  const count = (m: Map<string, number>, id: string | null, n = 1) => { if (id) m.set(id, (m.get(id) ?? 0) + n); };
  const uCreated = new Map<string, number>(), uClosed = new Map<string, number>(), uComments = new Map<string, number>(),
    uTransfers = new Map<string, number>(), uReceived = new Map<string, number>();
  for (const t of created) count(uCreated, t.createdById);
  for (const t of closed) count(uClosed, t.closedById);
  for (const c of comments) count(uComments, c.authorId, c._count);
  for (const e of events) count(e.action === "received" ? uReceived : uTransfers, e.actorId, e._count);
  const byUser = users.map((u) => {
    const row = {
      id: u.id, name: u.fullName, username: u.username, teams: u.teams.map((t) => t.team.name).join(" + "),
      created: uCreated.get(u.id) ?? 0, received: uReceived.get(u.id) ?? 0, transfers: uTransfers.get(u.id) ?? 0,
      comments: uComments.get(u.id) ?? 0, closed: uClosed.get(u.id) ?? 0, total: 0,
    };
    row.total = row.created + row.received + row.transfers + row.comments + row.closed;
    return row;
  }).filter((u) => u.total > 0).sort((a, b) => b.total - a.total);
  const activeIds = new Set(byUser.map((u) => u.id));
  const idleUsers = users.filter((u) => u.isActive && !activeIds.has(u.id)).length;

  return { kpi, days, byType, bySource, byCloseCategory, byTeam, byUser, idleUsers };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;
