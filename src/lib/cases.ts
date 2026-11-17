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

export async function fetchCasePatient(code: string): Promise<CasePatient> {
  if (!casesEnabled()) throw new Error("ربط سيستم الحالات غير مفعّل على السيرفر بعد");
  const base = process.env.CASES_URL!.replace(/\/+$/, "");
  let r: Response;
  try {
    r = await fetch(`${base}/api/cases/${encodeURIComponent(code)}`, {
      headers: { "x-api-key": process.env.CASES_API_KEY! }, cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("سيستم الحالات لا يستجيب حاليًا — املأ البيانات يدويًا أو حاول بعد قليل");
  }
  const j = (await r.json().catch(() => ({}))) as CaseResponse;
  if (r.status === 401 || r.status === 403) throw new Error("مفتاح سيستم الحالات غير صالح — راجع CASES_API_KEY");
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
