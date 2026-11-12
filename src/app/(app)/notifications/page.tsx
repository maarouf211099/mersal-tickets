import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { MarkAllButton, OpenLink } from "./client";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const s = await auth();
  if (!s) redirect("/login");
  const items = await prisma.notification.findMany({
    where: { userId: s.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader icon="🔔" title="الإشعارات" subtitle={unread > 0 ? `${unread} غير مقروءة` : "كل الإشعارات مقروءة"}>
        {unread > 0 && <MarkAllButton />}
      </PageHeader>
      <ul className="card stagger divide-y divide-slate-100 overflow-hidden">
        {items.map((n) => (
          <li key={n.id} className={`flex items-start justify-between gap-3 p-4 transition-colors hover:bg-slate-50 ${n.isRead ? "" : "bg-brand-50/50"}`}>
            <div className="flex min-w-0 items-start gap-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm ring-1 ring-slate-200">
                {ICONS[n.type] ?? "🔔"}
                {!n.isRead && <span className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-white" />}
              </span>
              <div className="min-w-0">
              <div className={`text-sm ${n.isRead ? "text-slate-700" : "font-semibold text-slate-900"}`}>{n.title}</div>
              {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-slate-500 [overflow-wrap:anywhere]">{n.body}</div>}
              <div className="mt-1 text-xs text-slate-400">{formatDateTime(n.createdAt)}</div>
            </div>
            </div>
            {n.ticketId ? <OpenLink id={n.id} href={`/tickets/${n.ticketId}`} /> : null}
          </li>
        ))}
        {items.length === 0 && <li className="p-12 text-center text-sm text-slate-400"><div className="mb-2 text-4xl">🔕</div>لا توجد إشعارات</li>}
      </ul>
      <p className="text-center text-xs text-slate-400"><Link href="/tickets" className="hover:underline">← التذاكر</Link></p>
    </div>
  );
}

const ICONS: Record<string, string> = {
  new_ticket: "🎫", transferred: "↪️", mention: "@", comment: "💬", update: "💬", note: "📝",
  assigned: "👤", closed: "✅", reopened: "🔄", sla_breached: "⛔", triaged: "🩺", research: "🔬",
};
