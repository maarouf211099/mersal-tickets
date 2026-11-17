import type { DeviceStage } from "@/lib/workflow";

const STEPS: { key: DeviceStage[]; label: string; icon: string }[] = [
  { key: ["doctor_review"], label: "طبيب المتابعة", icon: "🩺" },
  { key: ["research_review"], label: "الأبحاث", icon: "🔬" },
  { key: ["decisions_review"], label: "القرارات", icon: "⚖️" },
  { key: ["awaiting_stock", "awaiting_delivery"], label: "المخزن", icon: "📦" },
  { key: ["with_patient"], label: "مع المريض", icon: "🏠" },
  { key: ["returned"], label: "رجع", icon: "↩" },
];

// مراحل طلب الجهاز — المرحلة الحالية بتنبض
export function DeviceStepper({ stage }: { stage: DeviceStage }) {
  if (stage === "cancelled") {
    return <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">❌ الطلب اتلغى (رفض طبيب المتابعة)</div>;
  }
  const cur = STEPS.findIndex((s) => s.key.includes(stage));
  return (
    <ol className="mt-1 flex items-start gap-1 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done = i < cur, now = i === cur;
        return (
          <li key={s.label} className="flex min-w-[64px] flex-1 flex-col items-center gap-1.5 text-center">
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : done || now ? "bg-sky-500" : "bg-slate-200"}`} />
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm transition ${
                now ? "animate-glow bg-sky-600 text-white shadow-lg shadow-sky-600/30 ring-4 ring-sky-100" : done ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-400"}`}>
                {done ? "✓" : s.icon}
              </span>
              <span className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? "opacity-0" : done ? "bg-sky-500" : "bg-slate-200"}`} />
            </div>
            <span className={`text-[11px] font-medium ${now ? "text-sky-700" : done ? "text-slate-600" : "text-slate-400"}`}>
              {s.label}{now && stage === "awaiting_stock" ? " (مستني جهاز)" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
