import "server-only";
import { jwtVerify } from "jose";

// الدخول من بوابة مرسال — شغال بس لو PORTAL_SSO_SECRET متحط في .env
// لو مش متحط: المسارات بترجع 404 والنظام بيشتغل بالظبط زي الأول

export const PORTAL_SYSTEM_KEY = "tickets";
const ISSUER = "mersal-portal";

export function portalSecret(): Uint8Array | null {
  const s = process.env.PORTAL_SSO_SECRET;
  if (!s || s.length < 32) return null;
  return new TextEncoder().encode(s);
}

// منع استخدام نفس التذكرة مرتين (التذكرة أصلًا صالحة 60 ثانية بس)
const usedJti = new Map<string, number>();
function markUsed(jti: string): boolean {
  const now = Date.now();
  for (const [k, exp] of usedJti) if (exp < now) usedJti.delete(k);
  if (usedJti.has(jti)) return false;
  usedJti.set(jti, now + 2 * 60_000);
  return true;
}

export type PortalTicket = { portalUserId: string; email: string; name: string; localUsername: string | null };

export async function verifyPortalTicket(token: string): Promise<PortalTicket | null> {
  const secret = portalSecret();
  if (!secret || !token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"], issuer: ISSUER, audience: PORTAL_SYSTEM_KEY, maxTokenAge: "65s",
    });
    if (payload.typ !== "sso" || !payload.jti || !payload.sub || !markUsed(payload.jti)) return null;
    return {
      portalUserId: payload.sub,
      email: String(payload.email ?? "").toLowerCase(),
      name: String(payload.name ?? ""),
      localUsername: payload.lu ? String(payload.lu).toLowerCase() : null,
    };
  } catch {
    return null;
  }
}

/** للتأكد إن طلب الأرقام جاي من البوابة */
export async function verifyPortalSummaryRequest(authHeader: string | null): Promise<boolean> {
  const secret = portalSecret();
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!secret || !token) return false;
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"], issuer: ISSUER, audience: PORTAL_SYSTEM_KEY, maxTokenAge: "65s",
    });
    return payload.typ === "summary";
  } catch {
    return false;
  }
}
