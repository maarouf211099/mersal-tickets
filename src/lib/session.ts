// Edge-safe (بيستخدمه الـ middleware) — من غير Prisma
import { SignJWT, jwtVerify } from "jose";

// اسم كوكي خاص بالنظام ده — الكوكيز مش بتفرّق بين البورتات،
// فلو اسم الكوكي متكرر بين سيستمين على نفس السيرفر، الدخول في واحد بيطلّعك من التاني
export const SESSION_COOKIE = "mersal_tickets_session";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 ساعة

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET لازم يكون 32 حرف على الأقل في ملف .env");
  return new TextEncoder().encode(s);
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
