import { cn } from "@/lib/utils";
import { TYPE_LABELS, type SlaState, type TicketType } from "@/lib/workflow";

const slaMap: Record<SlaState, { label: string; cls: string; dot?: boolean }> = {
  within:   { label: "ضمن الوقت",     cls: "bg-emerald-100 text-emerald-800" },
  warning:  { label: "قارب على الانتهاء", cls: "bg-amber-100 text-amber-800" },
  breached: { label: "متأخر",         cls: "bg-red-100 text-red-800", dot: true },
  met:      { label: "أُغلقت في الموعد", cls: "bg-slate-100 text-slate-700" },
};

const typeMap: Record<TicketType, string> = {
  new_case:  "bg-violet-50 text-violet-700 border border-violet-200",
  follow_up: "bg-brand-50 text-brand-700 border border-brand-200",
  emergency: "bg-red-50 text-red-700 border border-red-200 font-semibold",
};
const typeIcon: Record<TicketType, string> = { new_case: "🆕", follow_up: "📋", emergency: "🚨" };

export function StatusBadge({ status }: { status: "pending" | "closed" }) {
  return status === "pending"
    ? <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">قيد التنفيذ</span>
    : <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">مغلقة</span>;
}

export function SlaBadge({ state }: { state: SlaState }) {
  const s = slaMap[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", s.cls)}>
      {s.dot && <span className="pulse-red inline-block h-2 w-2 rounded-full bg-red-600" />}
      {s.label}
    </span>
  );
}

export function TypeBadge({ type }: { type: TicketType }) {
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs", typeMap[type])}>
      {typeIcon[type]} {TYPE_LABELS[type]}
    </span>
  );
}

export function TeamChip({ name, color, observer }: { name: string; color: string; observer?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
      observer ? "border border-dashed border-slate-300 text-slate-500" : "bg-slate-100 font-medium text-slate-700",
    )}>
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {name}{observer && " (متابعة)"}
    </span>
  );
}
