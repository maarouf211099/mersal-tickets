import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { describeEvent, describeSystemEvent } from "@/lib/event-text";
import { Input, Select } from "@/components/ui/form";
import { displayName, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE = 100;

type Row = {
  key: string; at: Date; kind: "ticket" | "comment" | "system";
  actor: { fullName: string; username: string } | null;
  text: string; ticket?: { id: string; ticketNumber: string; beneficiaryName: string }; ip?: string | null;
};

// السجل العام: كل أحداث التذاكر + التحديثات والملاحظات + أحداث النظام (دخول، مستخدمين، فرق، موافقات)
export default async function AuditPage({ searchParams }: {
  searchParams: Promise<{ source?: string; userId?: string; day?: string; before?: string }>;
}) {
  const s = await auth();
  if (!s) redirect("/login");
  if (s.user.role !== "manager") redirect("/dashboard");
  const f = await searchParams;
  const source = f.source === "tickets" || f.source === "system" ? f.source : "all";

  const before = f.before ? new Date(f.before) : undefined;
  const dayStart = f.day ? new Date(`${f.day}T00:00:00+02:00`) : undefined;
  const dayEnd = dayStart ? new Date(dayStart.getTime() + 86_400_000) : undefined;
  const lt = before && dayEnd ? (before < dayEnd ? before : dayEnd) : (before ?? dayEnd);
  const createdAt = { ...(lt && { lt }), ...(dayStart && { gte: dayStart }) };
  const ticketSel = { select: { id: true, ticketNumber: true, beneficiaryName: true } };
  const actorSel = { select: { fullName: true, username: true } };

  const [events, comments, system, users] = await Promise.all([
    source === "system" ? [] : prisma.ticketEvent.findMany({
      where: { createdAt, ...(f.userId && { actorId: f.userId }) },
      orderBy: { createdAt: "desc" }, take: PAGE, include: { actor: actorSel, ticket: ticketSel },
    }),
    source === "system" ? [] : prisma.ticketComment.findMany({
      where: { createdAt, ...(f.userId && { authorId: f.userId }) },
      orderBy: { createdAt: "desc" }, take: PAGE, include: { author: actorSel, ticket: ticketSel },
    }),
    source === "tickets" ? [] : prisma.systemEvent.findMany({
      where: { createdAt, ...(f.userId && { actorId: f.userId }) },
      orderBy: { createdAt: "desc" }, take: PAGE, include: { actor: actorSel },
    }),
    prisma.user.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, username: true } }),
  ]);

  const rows: Row[] = [
    ...events.map((e): Row => ({
      key: `e${e.id}`, at: e.createdAt, kind: "ticket", actor: e.actor, ticket: e.ticket,
      text: describeEvent(e.action, e.metadata),
    })),
    ...comments.map((c): Row => ({
      key: `c${c.id}`, at: c.createdAt, kind: "comment", actor: c.author, ticket: c.ticket,
      text: `${c.kind === "note" ? "أضاف ملاحظة" : "أضاف تحديثًا"}: "${c.body.length > 120 ? c.body.slice(0, 120) + "…" : c.body}"`,
    })),
    ...system.map((e): Row => ({
      key: `s${e.id}`, at: e.createdAt, kind: "system", actor: e.actor, ip: e.ip,
      text: describeSystemEvent(e.action, e.metadata),
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, PAGE);

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (source !== "all") p.set("source", source);
    if (f.userId) p.set("userId", f.userId);
    if (f.day) p.set("day", f.day);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p.toString();
  };
  const KIND: Record<Row["kind"], { label: string; cls: string }> = {
    ticket: { label: "تذكرة", cls: "bg-brand-50 text-brand-700" },
    comment: { label: "تحديث", cls: "bg-sky-50 text-sky-700" },
    system: { label: "النظام", cls: "bg-amber-50 text-amber-800" },
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">السجل العام</h1>
        <p className="mt-1 text-sm text-slate-500">كل ما يحدث في النظام: من فعل ماذا ومتى — التذاكر والتحديثات، والدخول، والمستخدمين، والفرق، والموافقات.</p>
      </div>

      <form method="get" className="card grid grid-cols-1 gap-3 p-4 md:grid-cols-5">
        <Select name="source" defaultValue={source}>
          <option value="all">كل الأحداث</option>
          <option value="tickets">التذاكر والتحديثات</option>
          <option value="system">النظام (دخول، مستخدمين، فرق، موافقات)</option>
        </Select>
        <Select name="userId" defaultValue={f.userId ?? ""} className="md:col-span-2">
          <option value="">كل المستخدمين</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName} (@{u.username})</option>)}
        </Select>
        <Input type="date" name="day" defaultValue={f.day ?? ""} dir="ltr" />
        <div className="flex gap-2">
          <button className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">تصفية</button>
          <Link href="/admin/audit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">مسح</Link>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="data-table rows-in min-w-[860px]">
          <thead><tr><th>الوقت</th><th>المستخدم</th><th>النوع</th><th>الحدث</th><th>التذكرة</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(r.at)}</td>
                <td className="whitespace-nowrap text-xs">
                  {r.actor ? (
                    <>
                      <div className="font-medium text-slate-800">{displayName(r.actor.fullName)}</div>
                      <bdi dir="ltr" className="text-slate-400">@{r.actor.username}</bdi>
                    </>
                  ) : <span className="text-slate-400">{r.kind === "system" ? "زائر" : "النظام"}</span>}
                  {r.ip && <div className="font-mono text-[10px] text-slate-300" dir="ltr">{r.ip}</div>}
                </td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${KIND[r.kind].cls}`}>{KIND[r.kind].label}</span></td>
                <td className="text-sm text-slate-700">{r.text}</td>
                <td className="whitespace-nowrap text-xs">
                  {r.ticket && (
                    <Link href={`/tickets/${r.ticket.id}`} className="text-brand-700 hover:underline">
                      <div className="font-mono">{r.ticket.ticketNumber}</div>
                      <div className="text-slate-500">{r.ticket.beneficiaryName}</div>
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-sm text-slate-400">لا توجد أحداث</td></tr>}
          </tbody>
        </table>
      </div>

      {rows.length === PAGE && (
        <div className="flex justify-center">
          <Link className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            href={`/admin/audit?${qs({ before: rows[rows.length - 1].at.toISOString() })}`}>
            أحداث أقدم ←
          </Link>
        </div>
      )}
    </div>
  );
}
