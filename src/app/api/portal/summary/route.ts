import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalSecret, verifyPortalSummaryRequest } from "@/lib/portal-sso";

export const dynamic = "force-dynamic";

// أرقام كارت التذاكر في داشبورد البوابة — أرقام إجمالية بس، من غير أي بيانات مستفيدين
export async function GET(req: NextRequest) {
  if (!portalSecret()) return new NextResponse("Not Found", { status: 404 });
  if (!(await verifyPortalSummaryRequest(req.headers.get("authorization")))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  // بداية اليوم بتوقيت القاهرة
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(now).map((x) => [x.type, Number(x.value)]),
  );
  const dayStartUtc = new Date(now.getTime() - ((p.hour * 60 + p.minute) * 60 + p.second) * 1000 - now.getMilliseconds());

  const [open, overdue, emergency, today] = await Promise.all([
    prisma.ticket.count({ where: { status: "pending" } }),
    prisma.ticket.count({ where: { status: "pending", slaDeadline: { lt: now } } }),
    prisma.ticket.count({ where: { status: "pending", type: "emergency" } }),
    prisma.ticket.count({ where: { createdAt: { gte: dayStartUtc } } }),
  ]);
  return NextResponse.json({
    items: [
      { label: "مفتوحة", value: open, tone: "info" },
      { label: "متأخرة عن الـSLA", value: overdue, tone: overdue > 0 ? "bad" : "ok" },
      { label: "طوارئ مفتوحة", value: emergency, tone: emergency > 0 ? "warn" : "ok" },
      { label: "اتفتحت النهارده", value: today },
    ],
    updatedAt: now.toISOString(),
  });
}
