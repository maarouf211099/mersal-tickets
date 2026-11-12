import "server-only";

// ربط نظام التذاكر بنظام إسعاف مرسال (mersal-ambulance-system)
// النظام بيدخل بيوزر مخصص (دور «منسق») وبيبعت البلاغ على نفس الـ API اللي المنسقين بيستخدموها.
// الإعدادات في .env:
//   AMBULANCE_URL       (مثلًا https://ambulance.mersal-ngo.info)
//   AMBULANCE_USERNAME  / AMBULANCE_PASSWORD

export * from "./ambulance-options";

const cfg = () => ({
  url: (process.env.AMBULANCE_URL || "").replace(/\/+$/, ""),
  user: process.env.AMBULANCE_USERNAME || "",
  pass: process.env.AMBULANCE_PASSWORD || "",
});

export function ambulanceEnabled() {
  const c = cfg();
  return !!(c.url && c.user && c.pass);
}

// رابط البلاغ جوه نظام الإسعاف
export function ambulanceLink(remoteId: number) {
  return `${cfg().url}/#req=${remoteId}`;
}

const g = globalThis as unknown as { __ambToken?: string };

async function login(): Promise<string> {
  const c = cfg();
  const r = await fetch(`${c.url}/api/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: c.user, password: c.pass }),
    signal: AbortSignal.timeout(15_000), cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw new Error("تعذّر الدخول على نظام الإسعاف — راجع بيانات AMBULANCE_USERNAME / AMBULANCE_PASSWORD");
  g.__ambToken = j.token;
  return j.token;
}

// طلب على نظام الإسعاف — لو التوكن خلص بيدخل تاني مرة واحدة
async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (!ambulanceEnabled()) throw new Error("ربط نظام الإسعاف غير مفعّل على السيرفر");
  const c = cfg();
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = g.__ambToken || (await login());
    let r: Response;
    try {
      r = await fetch(`${c.url}${path}`, {
        method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000), cache: "no-store",
      });
    } catch {
      throw new Error("نظام الإسعاف لا يستجيب حاليًا — حاول مرة أخرى بعد قليل");
    }
    if (r.status === 401 && attempt === 0) { g.__ambToken = undefined; continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ? `نظام الإسعاف: ${j.error}` : `نظام الإسعاف رجّع خطأ (${r.status})`);
    return j as T;
  }
  throw new Error("تعذّر الدخول على نظام الإسعاف");
}

export async function createAmbulanceRequest(body: Record<string, unknown>): Promise<number> {
  const j = await call<{ id?: number }>("POST", "/api/requests", body);
  if (!j.id) throw new Error("نظام الإسعاف لم يرجّع رقم البلاغ");
  return j.id;
}

export async function ambulanceStatus(remoteId: number): Promise<{ status: string; car?: string; paramedic?: string }> {
  const j = await call<{ request?: { status?: string; car?: string; paramedic?: string } }>("GET", `/api/requests/${remoteId}/full`);
  return { status: j.request?.status ?? "", car: j.request?.car, paramedic: j.request?.paramedic };
}
