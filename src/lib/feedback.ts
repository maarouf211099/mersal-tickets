// تقييم النظام — دوال صافية من غير داتابيز عشان تتختبر لوحدها (feedback.test.ts)

// حملة التقييم الحالية — لازم تطابق CAMPAIGN في public/mersal-feedback.js
export const FEEDBACK_CAMPAIGN = "eval-2026-11";

// مين يشوف نتايج التقييم:
//   - أي مستخدم بدور "manager" (مدير النظام — أعلى دور في UserRole، زي isAdmin في permissions.ts)
//   - بالإضافة لمستخدم واحد محدد حتى لو مش مدير: FEEDBACK_RESULTS_USER في .env (الافتراضي mahmoud.maarouf)
//     بيتقارن باسم المستخدم، أو بالجزء اللي قبل @ لو الحساب بالإيميل
export const DEFAULT_FEEDBACK_RESULTS_USER = "mahmoud.maarouf";
export const FEEDBACK_RESULTS_ROLES: readonly string[] = ["manager"];

export function feedbackResultsUser(): string {
  return (process.env.FEEDBACK_RESULTS_USER || "").trim().toLowerCase() || DEFAULT_FEEDBACK_RESULTS_USER;
}

function isResultsUser(username: string | null | undefined, allowed: string): boolean {
  const u = (username || "").trim().toLowerCase();
  const a = allowed.trim().toLowerCase();
  if (!u || !a) return false;
  if (u === a) return true;
  // الحسابات اللي اسمها إيميل: نقارن الجزء اللي قبل @ بس
  const at = u.lastIndexOf("@");
  return at > 0 && u.slice(0, at) === a;
}

export function canViewFeedbackResults(
  user: { username?: string | null; role?: string | null } | null | undefined,
  allowed = feedbackResultsUser(),
): boolean {
  if (!user) return false;
  if (user.role && FEEDBACK_RESULTS_ROLES.includes(user.role)) return true;
  return isResultsUser(user.username, allowed);
}

export type FeedbackInput = {
  overall: number;
  ease: number | null;
  speed: number | null;
  value: number | null;
  problems: string | null;
  ideas: string | null;
  department: string;
  name: string | null;
};

const LIMITS = { department: 120, name: 120, problems: 2000, ideas: 2000 } as const;

function rating(v: unknown, required: boolean): number | null | undefined {
  if (v === null || v === undefined || v === "") return required ? undefined : null;
  const n = typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5 ? n : undefined;
}

function text(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s : null;
}

// بيرجّع الداتا النضيفة أو رسالة خطأ بالعربي تتعرض للمستخدم
export function parseFeedback(body: unknown): { data: FeedbackInput } | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "بيانات التقييم غير صحيحة." };
  const b = body as Record<string, unknown>;

  const overall = rating(b.overall, true);
  if (overall == null) return { error: "من فضلك اختار التقييم العام (من 1 لـ 5 نجوم)." };
  const ease = rating(b.ease, false);
  const speed = rating(b.speed, false);
  const value = rating(b.value, false);
  if (ease === undefined || speed === undefined || value === undefined) return { error: "التقييم لازم يكون من 1 لـ 5 نجوم." };

  const department = text(b.department);
  if (department === undefined) return { error: "اسم القسم غير صحيح." };
  if (!department) return { error: "من فضلك اكتب القسم أو الإدارة." };
  if (department.length > LIMITS.department) return { error: `اسم القسم طويل — الحد ${LIMITS.department} حرف.` };

  const name = text(b.name);
  if (name === undefined) return { error: "الاسم غير صحيح." };
  if (name && name.length > LIMITS.name) return { error: `الاسم طويل — الحد ${LIMITS.name} حرف.` };

  const problems = text(b.problems);
  const ideas = text(b.ideas);
  if (problems === undefined || ideas === undefined) return { error: "بيانات التقييم غير صحيحة." };
  if (problems && problems.length > LIMITS.problems) return { error: `خانة المشاكل طويلة — الحد ${LIMITS.problems} حرف.` };
  if (ideas && ideas.length > LIMITS.ideas) return { error: `خانة الاقتراحات طويلة — الحد ${LIMITS.ideas} حرف.` };

  return { data: { overall, ease, speed, value, problems, ideas, department, name } };
}
