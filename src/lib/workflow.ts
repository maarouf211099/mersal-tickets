// منطق الـ workflow — دوال صافية من غير داتابيز عشان تتختبر لوحدها (workflow.test.ts)

export type TicketType = "new_case" | "follow_up" | "emergency";
export type TicketSource = "call_center" | "social_media" | "reception" | "clinics";
export type TriageLevel = "emergency" | "urgent";
export type ResearchDecision = "accepted" | "rejected";

// ─── SLA ───────────────────────────────────────────────
export const SLA_MINUTES: Record<TicketType, number> = {
  new_case: 48 * 60,
  follow_up: 72 * 60,
  emergency: 30,
};

export function slaDeadlineFor(type: TicketType, createdAt: Date): Date {
  return new Date(createdAt.getTime() + SLA_MINUTES[type] * 60_000);
}

export type SlaState = "within" | "warning" | "breached" | "met";

// التيكت المقفولة: met لو اتقفلت قبل الموعد، breached لو بعده.
// المفتوحة: warning بعد 80% من الوقت، breached بعد الموعد.
export function slaState(
  t: { createdAt: Date; slaDeadline: Date; closedAt?: Date | null },
  now: Date = new Date(),
): SlaState {
  if (t.closedAt) return t.closedAt <= t.slaDeadline ? "met" : "breached";
  if (now >= t.slaDeadline) return "breached";
  const total = t.slaDeadline.getTime() - t.createdAt.getTime();
  const elapsed = now.getTime() - t.createdAt.getTime();
  return elapsed / total >= 0.8 ? "warning" : "within";
}

// ─── Labels ────────────────────────────────────────────
export const TYPE_LABELS: Record<TicketType, string> = {
  new_case: "حالة جديدة",
  follow_up: "متابعة",
  emergency: "طوارئ",
};

export const TYPE_PREFIX: Record<TicketType, string> = {
  new_case: "NC",
  follow_up: "FU",
  emergency: "EM",
};

export const SOURCE_LABELS: Record<TicketSource, string> = {
  call_center: "مركز الاتصال",
  social_media: "وسائل التواصل الاجتماعي",
  reception: "الاستقبال",
  clinics: "العيادات",
};

export const TRIAGE_LABELS: Record<TriageLevel, string> = {
  emergency: "طارئة",
  urgent: "عاجلة",
};

export const RELATIONSHIPS = [
  "الحالة نفسها", "أب", "أم", "زوج", "زوجة", "ابن", "ابنة", "أخ", "أخت", "قريب آخر", "أخرى",
];

export const EGYPTIAN = "مصري";
export const NATIONALITIES = [
  EGYPTIAN, "سوداني", "جنوب سوداني", "سوري", "يمني", "إريتري", "إثيوبي", "صومالي", "عراقي", "أخرى",
];

// ─── التيمات ───────────────────────────────────────────
// الأكواد دي ثابتة — الأسماء والألوان المدير يقدر يغيرها من صفحة التيمات
export const TEAM = {
  ALEXANDRIA: "ALEXANDRIA",
  EMERGENCY_HOTLINE: "EMERGENCY_HOTLINE",
  REGISTRATION: "REGISTRATION",
  HOTLINE_DOCTOR: "HOTLINE_DOCTOR",
  RESEARCH: "RESEARCH",
  FOLLOWUP_DOCTOR: "FOLLOWUP_DOCTOR",
  CALL_CENTER: "CALL_CENTER",
  SOCIAL_MEDIA: "SOCIAL_MEDIA",
  RECEPTION: "RECEPTION",
  CLINICS: "CLINICS",
} as const;

export type SeedTeam = {
  code: string; name: string; color: string; description: string;
  isReceiver: boolean; transferOnlyFrom?: string;
};

export const DEFAULT_TEAMS: SeedTeam[] = [
  // تيمات الاستقبال (بيتحول لها التيكت)
  { code: TEAM.ALEXANDRIA, name: "فريق الإسكندرية", color: "#0284c7", description: "فريق فرع الإسكندرية", isReceiver: true },
  { code: TEAM.EMERGENCY_HOTLINE, name: "خط طوارئ مرسال", color: "#dc2626", description: "خط الطوارئ الساخن (Emergency Hotline)", isReceiver: true },
  { code: TEAM.REGISTRATION, name: "التسجيل والاتصال الخارجي", color: "#7c3aed", description: "التسجيل والاتصالات الصادرة (Registration / Outbound)", isReceiver: true },
  // مسار الدكاترة — مش ظاهر غير لمرسال إيمرجنسي هوت لاين
  { code: TEAM.HOTLINE_DOCTOR, name: "طبيب الخط الساخن", color: "#be185d", description: "التصنيف الطبي للحالات (Hotline Doctor)", isReceiver: false, transferOnlyFrom: TEAM.EMERGENCY_HOTLINE },
  { code: TEAM.RESEARCH, name: "الأبحاث", color: "#b45309", description: "قبول أو رفض الحالات", isReceiver: false, transferOnlyFrom: TEAM.HOTLINE_DOCTOR },
  { code: TEAM.FOLLOWUP_DOCTOR, name: "طبيب المتابعة", color: "#047857", description: "متابعة الحالات المقبولة", isReceiver: false, transferOnlyFrom: TEAM.HOTLINE_DOCTOR },
  // مصادر الإدخال
  { code: TEAM.CALL_CENTER, name: "مركز الاتصال", color: "#d97706", description: "مصدر إدخال", isReceiver: false },
  { code: TEAM.SOCIAL_MEDIA, name: "وسائل التواصل الاجتماعي", color: "#2563eb", description: "مصدر إدخال", isReceiver: false },
  { code: TEAM.RECEPTION, name: "الاستقبال", color: "#059669", description: "مصدر إدخال", isReceiver: false },
  { code: TEAM.CLINICS, name: "العيادات", color: "#0891b2", description: "مصدر إدخال", isReceiver: false },
];

// تيم الإدخال → المصدر الافتراضي في فورم التيكت
export const SOURCE_BY_TEAM_CODE: Record<string, TicketSource> = {
  [TEAM.CALL_CENTER]: "call_center",
  [TEAM.SOCIAL_MEDIA]: "social_media",
  [TEAM.RECEPTION]: "reception",
  [TEAM.CLINICS]: "clinics",
};

export type TeamLite = {
  id: string;
  code: string | null;
  isActive: boolean;
  isReceiver: boolean;
  transferOnlyFromId: string | null;
};

// التيمات اللي المستخدم يقدر يحوّل لها (أو يختارها وقت الإنشاء)
// - تيم مقيد (transferOnlyFrom): يظهر بس لأعضاء التيم المسموح له (والمدير)
// - غير كده: لازم يكون تيم استقبال
export function transferTargets<T extends TeamLite>(
  teams: T[], actorTeamIds: string[], isManager: boolean, exclude: string[] = [],
): T[] {
  return teams.filter((t) => {
    if (!t.isActive || exclude.includes(t.id)) return false;
    if (t.transferOnlyFromId) return isManager || actorTeamIds.includes(t.transferOnlyFromId);
    return t.isReceiver;
  });
}

// ─── مسار الهوت لاين دكتور ─────────────────────────────
// طارئة → الأبحاث أولاً. عاجلة → الفولو اب دكتور + الأبحاث في نفس الوقت.
export function triageHolders(level: TriageLevel): string[] {
  return level === "emergency" ? [TEAM.RESEARCH] : [TEAM.RESEARCH, TEAM.FOLLOWUP_DOCTOR];
}

// قبول → يروح للفولو اب دكتور (لو مش عنده أصلاً). رفض → يتقفل بكومنت إجباري.
export function researchOutcome(decision: ResearchDecision): {
  close: boolean; addHolders: string[]; requiresComment: boolean;
} {
  if (decision === "rejected") return { close: true, addHolders: [], requiresComment: true };
  return { close: false, addHolders: [TEAM.FOLLOWUP_DOCTOR], requiresComment: false };
}

// ─── Input helpers ─────────────────────────────────────
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (d) => {
    const i = AR_DIGITS.indexOf(d);
    return String(i >= 0 ? i : FA_DIGITS.indexOf(d));
  });
}

// مصري → رقم قومي 14 رقم. غير مصري → رقم المفوضية إجباري.
export function identityError(nationality: string, nationalId: string, unhcrNumber: string): string | null {
  if (nationality === EGYPTIAN) {
    if (!/^\d{14}$/.test(nationalId)) return "يجب أن يتكون الرقم القومي من 14 رقمًا";
    return null;
  }
  if (unhcrNumber.trim().length < 3) return "رقم المفوضية مطلوب لغير المصريين";
  return null;
}

export function parseMentions(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/(^|[^a-zA-Z0-9._-])@([a-zA-Z0-9._-]{2,})/g)) {
    out.add(m[2].replace(/[._-]+$/, "").toLowerCase());
  }
  return [...out];
}
