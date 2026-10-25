import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// الـ Nav بيسأل كل 20 ثانية: عدد غير المقروء + الجديد من آخر مرة
export async function GET(req: Request) {
  const s = await auth();
  if (!s) return Response.json({ error: "unauthorized" }, { status: 401 });
  const sinceParam = new URL(req.url).searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;
  const [unread, fresh] = await Promise.all([
    prisma.notification.count({ where: { userId: s.user.id, isRead: false } }),
    since && !isNaN(since.getTime())
      ? prisma.notification.findMany({
          where: { userId: s.user.id, createdAt: { gt: since } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, type: true, title: true, body: true, ticketId: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);
  return Response.json({ unread, fresh, now: new Date().toISOString() });
}
