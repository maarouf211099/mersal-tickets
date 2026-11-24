import { auth } from "@/lib/auth";
import { isManager } from "@/lib/access";
import { fetchCasePatient } from "@/lib/cases";

export const dynamic = "force-dynamic";

// فحص ربط سيستم الحالات (للمدير): /api/cases-check?code=12345
export async function GET(req: Request) {
  const s = await auth();
  if (!s || !isManager(s.user)) return Response.json({ error: "للمدير فقط" }, { status: 403 });
  const code = new URL(req.url).searchParams.get("code")?.trim() || "1";
  const key = process.env.CASES_API_KEY?.trim() ?? "";
  const info = {
    CASES_URL: process.env.CASES_URL || "(مش متسجل)",
    CASES_API_KEY: key ? `${key.slice(0, 12)}… (${key.length} حرف)` : "(مش متسجل)",
    keyLooksValid: /^msk_[a-f0-9]{8}_[A-Za-z0-9_-]{20,}$/.test(key),
    code,
  };
  const t = Date.now();
  try {
    const p = await fetchCasePatient(code);
    return Response.json({ ok: true, ms: Date.now() - t, ...info, result: { name: p.name, age: p.age, phone1: p.phone1, governorate: p.governorate } });
  } catch (e) {
    return Response.json({ ok: false, ms: Date.now() - t, ...info, error: e instanceof Error ? e.message : String(e) });
  }
}
