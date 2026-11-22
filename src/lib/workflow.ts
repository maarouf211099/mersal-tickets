// منطق الـ workflow — دوال صافية من غير داتابيز عشان تتختبر لوحدها (workflow.test.ts)

export type TicketType = "new_case" | "follow_up" | "emergency" | "device_request";
export type TicketSource = "call_center" | "social_media" | "reception" | "clinics";
export type TriageLevel = "emergency" | "urgent";
export type ResearchDecision = "accepted" | "rejected";

// ─── SLA ───────────────────────────────────────────────
export const SLA_MINUTES: Record<TicketType, number> = {
  new_case: 48 * 60,
  follow_up: 72 * 60,
  emergency: 30,
  device_request: 0, // من غير مهلة
};

// تذاكر من غير مهلة (طلب جهاز طبي) بتاخد موعد بعيد جدًا بدل null — كده باقي الكود ما يتغيرش
export const NO_SLA_DEADLINE = new Date("2999-12-31T00:00:00Z");
export const hasSla = (t: { slaDeadline: Date }) => t.slaDeadline.getTime() < NO_SLA_DEADLINE.getTime() - 86_400_000;

// sla: المهل اللي المدير حددها في الإعدادات (لو مش متبعتة بنستخدم الافتراضي)
export function slaDeadlineFor(type: TicketType, createdAt: Date, sla: Record<TicketType, number> = SLA_MINUTES): Date {
  if (type === "device_request" || !sla[type]) return NO_SLA_DEADLINE;
  return new Date(createdAt.getTime() + sla[type] * 60_000);
}

// تيكت طوارئ اتحولت للتسجيل والاتصال الخارجي → مهلتها بتبقى 48 ساعة من وقت التحويل
export const OUTBOUND_EMERGENCY_SLA_MINUTES = 48 * 60;

export function slaDeadlineAfterTransfer(type: TicketType, targetCode: string | null, at: Date): Date | null {
  if (type === "emergency" && targetCode === TEAM.REGISTRATION) {
    return new Date(at.getTime() + OUTBOUND_EMERGENCY_SLA_MINUTES * 60_000);
  }
  return null;
}

// استلام تيكت طوارئ: المهلة بتبدأ من جديد من لحظة الاستلام
// (48 ساعة لو عند التسجيل والاتصال الخارجي، غير كده 30 دقيقة)
export function slaDeadlineAfterReceive(
  type: TicketType, holderCodes: (string | null)[], at: Date, sla: Record<TicketType, number> = SLA_MINUTES,
): Date | null {
  if (type !== "emergency") return null;
  const minutes = holderCodes.includes(TEAM.REGISTRATION) ? OUTBOUND_EMERGENCY_SLA_MINUTES : sla.emergency;
  return new Date(at.getTime() + minutes * 60_000);
}

export const GENDERS = ["ذكر", "أنثى"];

// أسباب إغلاق التذكرة (قائمة منسدلة إلزامية)
export const CLOSE_CATEGORIES = [
  "تعذر الوصول لمدة أكثر من 24 ساعة",
  "عدم إرسال التقارير",
  "وفاة",
  "تم توفير الخدمة خارج مرسال",
  "مديونية",
  "مكررة",
  "رفض الخدمة",
  "استبعاد الأبحاث",
  "توفير الخدمة من وزارة الصحة أو التأمين",
  "تم استلام الحالة",
];

export function minutesLabel(m: number): string {
  if (m < 60) return `${m} دقيقة`;
  if (m % 1440 === 0 && m > 4320) return `${m / 1440} يوم`;
  return m % 60 === 0 ? `${m / 60} ساعة` : `${Math.floor(m / 60)} ساعة و${m % 60} دقيقة`;
}

export function slaLabel(type: TicketType, sla: Record<TicketType, number> = SLA_MINUTES): string {
  if (type === "device_request" || !sla[type]) return "بدون مهلة";
  return minutesLabel(sla[type]);
}

export type SlaState = "within" | "warning" | "breached" | "met" | "none";

// التيكت المقفولة: met لو اتقفلت قبل الموعد، breached لو بعده.
// المفتوحة: warning بعد 80% من الوقت، breached بعد الموعد.
export function slaState(
  t: { createdAt: Date; slaDeadline: Date; closedAt?: Date | null },
  now: Date = new Date(),
): SlaState {
  if (!hasSla(t)) return "none";
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
  device_request: "طلب جهاز طبي",
};

export const TYPE_PREFIX: Record<TicketType, string> = {
  new_case: "NC",
  follow_up: "FU",
  emergency: "EM",
  device_request: "DV",
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
  MERSAL_DECISIONS: "MERSAL_DECISIONS",
  WAREHOUSE: "WAREHOUSE",
  ENGINEERING: "ENGINEERING",
  PROCUREMENT: "PROCUREMENT",
  EMERGENCY_ADMIN: "EMERGENCY_ADMIN",
} as const;

export type SeedTeam = {
  code: string; name: string; color: string; description: string;
  isReceiver: boolean; transferOnlyFrom?: string;
};

export const DEFAULT_TEAMS: SeedTeam[] = [
  // تيمات الاستقبال (بيتحول لها التيكت)
  { code: TEAM.ALEXANDRIA, name: "فريق SHC", color: "#0284c7", description: "فريق SHC", isReceiver: true },
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
  { code: TEAM.MERSAL_DECISIONS, name: "قرارات مرسال", color: "#4f46e5", description: "قرارات مرسال", isReceiver: true },
  { code: TEAM.EMERGENCY_ADMIN, name: "Admin الطوارئ", color: "#9f1239", description: "إبلاغ الحالات بقرار الاستبعاد أو الغلق", isReceiver: false },
  // الأجهزة الطبية
  { code: TEAM.WAREHOUSE, name: "المخزن", color: "#0f766e", description: "صرف واستلام الأجهزة الطبية", isReceiver: false },
  { code: TEAM.ENGINEERING, name: "الهندسية", color: "#475569", description: "فحص وصيانة الأجهزة الطبية", isReceiver: false },
  { code: TEAM.PROCUREMENT, name: "المشتريات", color: "#a16207", description: "شراء الأجهزة الناقصة", isReceiver: false },
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

// الرقم القومي ورقم المفوضية اختياريين. لو الرقم القومي اتكتب لازم يبقى 14 رقم.
export function identityError(nationality: string, nationalId: string, _unhcrNumber: string): string | null {
  if (nationality === EGYPTIAN && nationalId && !/^\d{14}$/.test(nationalId)) {
    return "يجب أن يتكون الرقم القومي من 14 رقمًا";
  }
  return null;
}

// فريق الأبحاث: والتذكرة عنده، يقدر يرجّعها لطبيب الخط الساخن أو يحوّلها لقرارات مرسال بس
export const RESEARCH_TRANSFER_CODES: string[] = [TEAM.HOTLINE_DOCTOR, TEAM.MERSAL_DECISIONS];
// قرارات مرسال بتحوّل للفرق دي بس (والقرار نفسه بزراير تكفل / استبعاد / غلق)
export const DECISIONS_TRANSFER_CODES: string[] = [TEAM.RESEARCH, TEAM.FOLLOWUP_DOCTOR, TEAM.HOTLINE_DOCTOR];

export type MersalDecision = "sponsor" | "exclude" | "close";
export const MERSAL_DECISION_LABELS: Record<MersalDecision, string> = { sponsor: "تكفل", exclude: "استبعاد", close: "غلق" };
// التكفل ← طبيب المتابعة، الاستبعاد والغلق ← Admin الطوارئ يبلّغ الحالة
export function mersalDecisionTarget(d: MersalDecision): string {
  return d === "sponsor" ? TEAM.FOLLOWUP_DOCTOR : TEAM.EMERGENCY_ADMIN;
}

export function transferTargetsForTicket<T extends TeamLite>(
  teams: T[], actorTeamIds: string[], isManager: boolean, holderIds: string[],
): T[] {
  const research = teams.find((t) => t.code === TEAM.RESEARCH);
  if (!isManager && research && holderIds.includes(research.id) && actorTeamIds.includes(research.id)) {
    return teams.filter((t) => t.isActive && !holderIds.includes(t.id) && !!t.code && RESEARCH_TRANSFER_CODES.includes(t.code));
  }
  const decisions = teams.find((t) => t.code === TEAM.MERSAL_DECISIONS);
  if (!isManager && decisions && holderIds.includes(decisions.id) && actorTeamIds.includes(decisions.id)) {
    return teams.filter((t) => t.isActive && !holderIds.includes(t.id) && !!t.code && DECISIONS_TRANSFER_CODES.includes(t.code));
  }
  return transferTargets(teams, actorTeamIds, isManager, holderIds);
}

export function parseMentions(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/(^|[^a-zA-Z0-9._-])@([a-zA-Z0-9._-]{2,})/g)) {
    out.add(m[2].replace(/[._-]+$/, "").toLowerCase());
  }
  return [...out];
}

// ─── الأجهزة الطبية ─────────────────────────────────────
export const DEVICE_TYPES = [
  "BiPap", "Cpap", "اسطوانة أكسجين", "جهاز سكر", "جهاز تنفس صناعي متنقل", "جهاز شفط",
  "جهاز قياس نسبة الاكسجين", "مرتبة هوائية", "مولد اكسجين 10 لتر", "مولد اكسجين 8 لتر",
  "مولد اكسجين 5 لتر", "مولد اكسجين 3 لتر", "جهاز نيبولايزر",
];

export type DeviceStatus = "in_stock" | "with_patient" | "maintenance" | "out_of_stock";
export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  in_stock: "في المخزن", with_patient: "مع مريض", maintenance: "في الهندسية", out_of_stock: "بره الاستوك",
};

export type DeviceStage =
  | "doctor_review" | "research_review" | "decisions_review" | "awaiting_stock"
  | "awaiting_delivery" | "with_patient" | "returned" | "cancelled";
export const DEVICE_STAGE_LABELS: Record<DeviceStage, string> = {
  doctor_review: "عند طبيب المتابعة", research_review: "عند الأبحاث", decisions_review: "عند قرارات مرسال",
  awaiting_stock: "في انتظار توفر جهاز (المشتريات)", awaiting_delivery: "جاهز للصرف (المخزن)",
  with_patient: "الجهاز مع المريض", returned: "الجهاز رجع", cancelled: "اتلغى",
};
// الفريق اللي بيتصرف في كل مرحلة
export const DEVICE_STAGE_TEAM: Partial<Record<DeviceStage, string>> = {
  doctor_review: TEAM.FOLLOWUP_DOCTOR, research_review: TEAM.RESEARCH, decisions_review: TEAM.MERSAL_DECISIONS,
  awaiting_stock: TEAM.PROCUREMENT, awaiting_delivery: TEAM.WAREHOUSE, with_patient: TEAM.WAREHOUSE,
};

export const ADULT_AGE = 18;
export function ageGroup(age: number | null | undefined): string | null {
  if (age == null || Number.isNaN(age)) return null;
  return age >= ADULT_AGE ? "فوق السن" : "تحت السن";
}

// موافقة / رفض في مراحل المراجعة
// الرفض من الأبحاث أو القرارات بيرجّع الطلب لطبيب المتابعة، ورفض الطبيب بيلغي الطلب
export function deviceDecisionOutcome(stage: DeviceStage, decision: "approve" | "reject", stockAvailable: number):
  { next: DeviceStage; team: string | null; close: boolean } {
  if (decision === "reject") {
    if (stage === "doctor_review") return { next: "cancelled", team: null, close: true };
    return { next: "doctor_review", team: TEAM.FOLLOWUP_DOCTOR, close: false };
  }
  if (stage === "doctor_review") return { next: "research_review", team: TEAM.RESEARCH, close: false };
  if (stage === "research_review") return { next: "decisions_review", team: TEAM.MERSAL_DECISIONS, close: false };
  return stockAvailable > 0
    ? { next: "awaiting_delivery", team: TEAM.WAREHOUSE, close: false }
    : { next: "awaiting_stock", team: TEAM.PROCUREMENT, close: false };
}
