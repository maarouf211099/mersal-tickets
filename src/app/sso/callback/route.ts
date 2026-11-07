import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { startSession } from "@/lib/auth";
import { logSystem } from "@/lib/audit";
import { portalSecret, verifyPortalTicket } from "@/lib/portal-sso";

export const dynamic = "force-dynamic";

// تحويل نسبي (Location: /path) — مانستخدمش req.url لأن السيرفر شغال على 0.0.0.0
// وكان التحويل بيروح لـ http://0.0.0.0:3005 بدل عنوان السيرفر الحقيقي
function redirectTo(pathAndQuery: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: pathAndQuery, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

// بوابة مرسال بتحوّل هنا بـ ?ticket=... — بنتأكد منها ونفتح جلسة عادية لنفس المستخدم
export async function GET(req: NextRequest) {
  if (!portalSecret()) return new NextResponse("Not Found", { status: 404 });

  const loginUrl = (err: "invalid" | "nouser") => redirectTo(`/login?sso=${err}`);

  const t = await verifyPortalTicket(req.nextUrl.searchParams.get("ticket") ?? "");
  if (!t) {
    await logSystem(null, "portal_sso_failed", { reason: "invalid_ticket" });
    return loginUrl("invalid");
  }

  // بندوّر باسم المستخدم المتحدد في البوابة، ولو مش متحدد بالإيميل (لما الحسابات تبقى بالإيميل)
  const candidates = [t.localUsername, t.email].filter((x): x is string => !!x);
  const user = await prisma.user.findFirst({ where: { username: { in: candidates }, isActive: true } });
  if (!user) {
    await logSystem(null, "portal_sso_failed", { reason: "no_local_user", email: t.email, tried: candidates });
    return loginUrl("nouser");
  }

  await startSession(user.id);
  await logSystem(user.id, "login", { via: "portal", portalUser: t.email });

  const next = req.nextUrl.searchParams.get("next") ?? "";
  const safe = /^\/(?![\/\\])/.test(next) && !next.includes("\\");
  return redirectTo(safe ? next : "/dashboard");
}
