// نصوص الأحداث بالعربي — مشتركة بين سجل التذكرة والسجل العام للنظام

type Meta = Record<string, unknown>;
const list = (v: unknown) => (Array.isArray(v) ? v.join(" + ") : String(v ?? ""));
const withNote = (s: string, note: unknown) => (note ? `${s} — "${note}"` : s);

export function describeEvent(action: string, metadata: unknown): string {
  const m = (metadata ?? {}) as Meta;
  switch (action) {
    case "created": return `أُنشئت التذكرة وحُوِّلت إلى ${m.to}`;
    case "transferred": return withNote(`حُوِّلت من ${list(m.from) || "—"} إلى ${m.to}`, m.note);
    case "triaged": return withNote(`صنّفها طبيب الخط الساخن حالةً ${m.level === "urgent" ? "عاجلة" : "طارئة"} ← ${list(m.to)}`, m.note);
    case "research_accepted": return withNote(`قبلت الأبحاث الحالة ← ${list(m.to)}`, m.comment);
    case "research_rejected": return withNote("رفضت الأبحاث الحالة وأُغلقت التذكرة", m.comment);
    case "closed": return withNote("أُغلقت التذكرة", m.reason);
    case "reopened": return withNote("أُعيد فتح التذكرة", m.note);
    case "assigned": return m.to ? `أُسندت إلى ${m.to}` : "أُلغي الإسناد";
    case "attachment_added": return `أُضيف مرفق: ${list(m.files)}`;
    case "sla_breached": return "⛔ تجاوزت التذكرة مهلة الإنجاز";
    case "details_updated": {
      const changes = (m.changes as { label: string; from: string | null; to: string | null }[]) ?? [];
      return "تعديل البيانات: " + changes.map((c) => `${c.label} (${c.from ?? "—"} ← ${c.to ?? "—"})`).join("، ");
    }
    default: return action;
  }
}

const ROLE_LABELS: Record<string, string> = { manager: "مدير", supervisor: "مشرف", agent: "موظف", viewer: "مشاهد" };

export function describeSystemEvent(action: string, metadata: unknown): string {
  const m = (metadata ?? {}) as Meta;
  const changes = (m.changes as { label: string; from: unknown; to: unknown }[] | undefined) ?? [];
  const changeText = changes.map((c) => `${c.label} (${c.from ?? "—"} ← ${c.to ?? "—"})`).join("، ");
  switch (action) {
    case "login": return "تسجيل دخول";
    case "login_failed": return `محاولة دخول فاشلة باسم المستخدم «${m.username}»`;
    case "password_changed": return "غيّر كلمة المرور الخاصة به";
    case "name_changed": return `غيّر اسمه (${m.from} ← ${m.to})`;
    case "user_created": return `أنشأ المستخدم ${m.name} (@${m.username}) بدور ${ROLE_LABELS[String(m.role)] ?? m.role}`;
    case "user_updated": return `عدّل المستخدم ${m.name} (@${m.username})${changeText ? `: ${changeText}` : ""}`;
    case "password_reset": return `أعاد تعيين كلمة مرور ${m.name} (@${m.username})`;
    case "users_imported": return `أضاف ${m.created} مستخدمًا دفعة واحدة`;
    case "team_created": return `أنشأ الفريق «${m.name}»`;
    case "team_updated": return `عدّل الفريق «${m.name}»${changeText ? `: ${changeText}` : ""}`;
    case "ticket_deleted": return `حذف التذكرة ${m.ticketNumber} (${m.beneficiaryName}) نهائيًا`;
    case "approval_created": return `أنشأ الموافقة ${m.number} — ${m.patientName}`;
    case "approval_reviewed": return `راجع الموافقة ${m.number}: ${m.status}`;
    case "approval_receipt": return `حدّث بيانات استلام الموافقة ${m.number}`;
    case "approval_deleted": return `حذف الموافقة ${m.number}`;
    case "approval_perms_updated": return `عدّل صلاحيات الموافقات للمستخدم ${m.name}`;
    default: return action;
  }
}
