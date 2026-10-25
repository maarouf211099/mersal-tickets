import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { MarkAllButton, OpenLink } from "./client";

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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">الإشعارات</h1>
          <p className="mt-1 text-sm text-slate-500">{unread} غير مقروءة</p>
        </div>
        {unread > 0 && <MarkAllButton />}
      </div>
      <ul className="card divide-y divide-slate-100">
        {items.map((n) => (
          <li key={n.id} className={`flex items-start justify-between gap-3 p-4 ${n.isRead ? "" : "bg-brand-50/50"}`}>
            <div className="min-w-0">
              <div className={`text-sm ${n.isRead ? "text-slate-700" : "font-semibold text-slate-900"}`}>{n.title}</div>
              {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</div>}
              <div className="mt-1 text-xs text-slate-400">{formatDateTime(n.createdAt)}</div>
            </div>
            {n.ticketId ? <OpenLink id={n.id} href={`/tickets/${n.ticketId}`} /> : null}
          </li>
        ))}
        {items.length === 0 && <li className="p-12 text-center text-sm text-slate-400">لا توجد إشعارات</li>}
      </ul>
      <p className="text-center text-xs text-slate-400"><Link href="/tickets" className="hover:underline">← التذاكر</Link></p>
    </div>
  );
}
