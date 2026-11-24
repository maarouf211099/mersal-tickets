import "server-only";

// ربط نظام التذاكر بسيستم الحالات (mersal-case-system) — قراءة بيانات المريض بالكود
// الإعدادات في .env:
//   CASES_URL      (مثلًا http://127.0.0.1:4000 أو https://mersal-ngo.info:4443)
//   CASES_API_KEY  مفتاح «قراءة بس» من سيستم الحالات (المديرين ← مفاتيح API)

export type CasePatient = {
  code: string; name: string; age: number | null; gender: string | null; nationality: string | null;
  religion: string | null; governorate: string | null; city: string | null; area: string | null;
  address: string | null; phone1: string | null; phone2: string | null;
  lastDecision: string | null; lastDecisionDate: string | null;
};

export function casesEnabled() {
  return !!(process.env.CASES_URL && process.env.CASES_API_KEY);
}

type Basic = { label: string; value: string };
type CaseResponse = {
  error?: string; code?: string | number; name?: string | null;
  profile?: { basic?: Basic[] } | null;
  decisions?: { text?: string; date?: string }[];
};

const clean = (v: string | undefined | null) => {
  const t = (v ?? "").toString().trim();
  return t && t !== "—" && t !== "-" ? t : null;
};
const digits = (v: string | null) => (v ? v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^\d+]/g, "") || null : null);

function normGender(v: string | null) {
  if (!v) return null;
  if (/أنث|انث|female|^f$/i.test(v)) return "أنثى";
  if (/ذكر|male|^m$/i.test(v)) return "ذكر";
  return null;
}

// سبب فشل الاتصال بالعربي — علشان نعرف المشكلة من رسالة الموظف
function netReason(e: unknown, url: string): string {
  const err = e as { name?: string; cause?: { code?: string; message?: string }; message?: string };
  const code = err?.cause?.code ?? "";
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return `سيستم الحالات اتأخر أكتر من ${TIMEOUT_MS / 1000} ثانية (${url})`;
  if (code === "ECONNREFUSED") return `مفيش حاجة شغالة على ${url} — العنوان أو البورت غلط أو سيستم الحالات واقف (ECONNREFUSED)`;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return `اسم السيرفر مش معروف (${url})`;
  if (code.startsWith("ERR_TLS") || /certificate|SSL|TLS/i.test(err?.cause?.message ?? "")) return `مشكلة شهادة HTTPS مع ${url} — جرّب http://127.0.0.1:4000`;
  if (code === "ECONNRESET" || code === "UND_ERR_SOCKET") return `الاتصال اتقفل من ناحية سيستم الحالات (${url})`;
  return `${code || err?.message || "خطأ غير معروف"} (${url})`;
}

const TIMEOUT_MS = 45_000;

export async function fetchCasePatient(code: string): Promise<CasePatient> {
  if (!casesEnabled()) throw new Error("ربط سيستم الحالات غير مفعّل على السيرفر بعد");
  // CASES_URL ممكن يبقى أكتر من عنوان مفصولين بفاصلة — بيجرّبهم بالترتيب لو الاتصال فشل
  const bases = process.env.CASES_URL!.split(",").map((u) => u.trim().replace(/\/+$/, "")).filter(Boolean);
  let r: Response | null = null;
  const reasons: string[] = [];
  for (const base of bases) {
    try {
      r = await fetch(`${base}/api/cases/${encodeURIComponent(code)}`, {
        headers: { "x-api-key": process.env.CASES_API_KEY!.trim(), accept: "application/json" },
        cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      break;
    } catch (e) {
      const why = netReason(e, base);
      console.error("[mersal-tickets] cases lookup failed:", why, e);
      reasons.push(why);
    }
  }
  if (!r) throw new Error(`مش قادر يوصل لسيستم الحالات — ${reasons.join(" / ")}`);
  const j = (await r.json().catch(() => ({}))) as CaseResponse;
  if (r.status === 401 || r.status === 403) throw new Error(j.error ? `سيستم الحالات رفض المفتاح: ${j.error}` : "مفتاح سيستم الحالات غير صالح — راجع CASES_API_KEY");
  if (r.status === 404) throw new Error(j.error || "الكود ده مش موجود في سيستم الحالات");
  if (!r.ok || j.error) throw new Error(j.error || `سيستم الحالات رجّع خطأ (${r.status})`);

  const basic = j.profile?.basic ?? [];
  const get = (...labels: string[]) => clean(basic.find((b) => labels.includes(b.label))?.value);
  const ageNum = Number(digits(get("السن")));
  const last = (j.decisions ?? []).find((d) => clean(d.text));
  return {
    code: String(j.code ?? code),
    name: clean(j.name) ?? get("اسم الحالة") ?? "",
    age: Number.isFinite(ageNum) && ageNum > 0 && ageNum < 130 ? ageNum : null,
    gender: normGender(get("الجنس", "النوع")),
    nationality: get("الجنسية"),
    religion: get("الديانة"),
    governorate: get("المحافظة"),
    city: get("المدينة"),
    area: get("المنطقة"),
    address: get("العنوان"),
    phone1: digits(get("موبايل")),
    phone2: digits(get("التليفون")),
    lastDecision: last?.text?.trim().slice(0, 1000) ?? null,
    lastDecisionDate: last?.date ?? null,
  };
}
