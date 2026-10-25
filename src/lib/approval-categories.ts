import type { ApprovalCategory } from "@prisma/client";

// كتالوج فئات الموافقات - كل فئة لها لون، أيقونة، وحقول خاصة
export type CategoryInfo = {
  key: ApprovalCategory;
  label: string;
  short: string;
  description: string;
  icon: string;
  color: string;
  // الحقول الخاصة بهذه الفئة (بالإضافة إلى الحقول العامة)
  extraFields?: Array<{ key: string; label: string; type: "text" | "textarea" | "select"; required?: boolean; options?: string[] }>;
};

export const APPROVAL_CATEGORIES: Record<ApprovalCategory, CategoryInfo> = {
  medications: {
    key: "medications",
    label: "الأدوية",
    short: "دواء",
    description: "طلب موافقة على صرف روشتة دوائية",
    icon: "💊",
    color: "#0d9488",
    extraFields: [
      { key: "disease",     label: "المرض / التخصص", type: "text", required: true },
      { key: "action",      label: "الإجراء المتخذ", type: "textarea" },
    ],
  },
  exceptions: {
    key: "exceptions",
    label: "استثناءات",
    short: "استثناء",
    description: "طلب استثنائي خارج البروتوكول الاعتيادي",
    icon: "⚠️",
    color: "#d97706",
    extraFields: [
      { key: "exceptionType",   label: "نوع الاستثناء", type: "select", required: true, options: ["أدوية", "فحوصات", "علاج طبيعي", "غسيل كلوي", "عمليات", "مستلزمات طبية", "أخرى"] },
      { key: "exceptionReason", label: "سبب الاستثناء", type: "textarea", required: true },
      { key: "specialty",       label: "التخصص", type: "text" },
      { key: "examType",        label: "نوع الكشف", type: "text" },
    ],
  },
  tests: {
    key: "tests",
    label: "الفحوصات والعروض",
    short: "فحوصات",
    description: "طلب موافقة على فحوصات طبية أو عروض تشخيصية",
    icon: "🔬",
    color: "#0891b2",
    extraFields: [
      { key: "specialty", label: "التخصص", type: "text", required: true },
    ],
  },
  immunosuppressants: {
    key: "immunosuppressants",
    label: "الالتومارس والوزمة والحساسية",
    short: "الالتومارس",
    description: "أدوية المناعة المتخصصة والحساسية",
    icon: "🧬",
    color: "#9333ea",
    extraFields: [
      { key: "disease",   label: "المرض", type: "text", required: true },
      { key: "specialty", label: "التخصص", type: "text" },
    ],
  },
  physio: {
    key: "physio",
    label: "العلاج الطبيعي والتخاطب",
    short: "علاج طبيعي",
    description: "جلسات علاج طبيعي أو تخاطب",
    icon: "🦴",
    color: "#059669",
    extraFields: [
      { key: "sessionsStatus",  label: "موقف الجلسات", type: "text" },
      { key: "evalCenter",      label: "جهة التقييم", type: "text" },
      { key: "currentCenter",   label: "الجهة الحالية للتنفيذ", type: "text" },
      { key: "doctorName",      label: "اسم الدكتور", type: "text" },
    ],
  },
  dialysis: {
    key: "dialysis",
    label: "الغسيل الكلوي",
    short: "غسيل كلوي",
    description: "طلبات ومتابعة حالات الغسيل الكلوي",
    icon: "🩸",
    color: "#dc2626",
    extraFields: [
      { key: "classification", label: "التصنيف", type: "text" },
    ],
  },
  operations: {
    key: "operations",
    label: "العمليات",
    short: "عمليات",
    description: "طلب موافقة على إجراء جراحي أو تدخل طبي",
    icon: "🏥",
    color: "#1e40af",
    extraFields: [
      { key: "disease",         label: "المرض", type: "text", required: true },
      { key: "classification",  label: "التصنيف", type: "text" },
      { key: "contactResult",   label: "نتيجة التواصل", type: "textarea" },
    ],
  },
  supplies: {
    key: "supplies",
    label: "المستلزمات الطبية",
    short: "مستلزمات",
    description: "طلب موافقة على صرف مستلزمات طبية",
    icon: "🩹",
    color: "#475569",
    extraFields: [
      { key: "supplyType", label: "نوع المستلزم المطلوب", type: "text", required: true },
      { key: "disease",    label: "المرض", type: "text" },
    ],
  },
};

export const APPROVAL_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:      { label: "في الانتظار",        cls: "bg-amber-100 text-amber-800" },
  under_review: { label: "قيد المراجعة",       cls: "bg-blue-100 text-blue-800" },
  approved:     { label: "تمت الموافقة",       cls: "bg-emerald-100 text-emerald-800" },
  rejected:     { label: "مرفوضة",              cls: "bg-red-100 text-red-800" },
  needs_info:   { label: "تحتاج توضيحاً",       cls: "bg-purple-100 text-purple-800" },
  dispensed:    { label: "تم الصرف",           cls: "bg-brand-100 text-brand-800" },
  closed:       { label: "مقفولة",              cls: "bg-slate-200 text-slate-700" },
};

export function categoryList(): CategoryInfo[] {
  return Object.values(APPROVAL_CATEGORIES);
}
