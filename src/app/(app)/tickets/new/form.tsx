"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTicket } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/form";
import { DetailsFields } from "@/components/tickets/details-fields";
import { slaLabel, SOURCE_LABELS, TYPE_LABELS, type TicketType } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { FileInput } from "@/components/ui/file-input";
import { toast } from "@/components/ui/toast";

const TYPES: { key: TicketType; icon: string; on: string; check: string; hint: string }[] = [
  { key: "emergency", icon: "🚨", on: "border-red-400 bg-red-50 shadow-red-500/10", check: "bg-red-500", hint: "حالة حرجة تحتاج تدخلًا فوريًا" },
  { key: "new_case", icon: "🆕", on: "border-violet-400 bg-violet-50 shadow-violet-500/10", check: "bg-violet-500", hint: "حالة تُسجَّل لأول مرة" },
  { key: "follow_up", icon: "📋", on: "border-brand-400 bg-brand-50 shadow-brand-500/10", check: "bg-brand-500", hint: "متابعة حالة مسجَّلة من قبل" },
];

export function NewTicketForm({ targets, defaultSource }: {
  targets: { id: string; name: string; color: string }[];
  defaultSource: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<TicketType | "">("");
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const team = targets.find((t) => t.id === teamId);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await createTicket(form);
      if (r.ok) { toast("تم إنشاء التذكرة"); router.push(`/tickets/${r.id}`); }
      else { setError(r.error); toast(r.error, "error"); }
    });
  }

  return (
    <form onSubmit={onSubmit} className="stagger space-y-5">
      <Step n={1} title="نوع الحالة" done={!!type}>
        <input type="hidden" name="type" value={type} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TYPES.map((t) => (
            <button key={t.key} type="button" onClick={() => setType(t.key)} aria-pressed={type === t.key}
              className={cn(
                "relative rounded-2xl border-2 p-4 text-right transition-all duration-200 active:scale-[0.98]",
                type === t.key ? t.on + " shadow-lg" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
              )}>
              {type === t.key && (
                <span className={`animate-check absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-white ${t.check}`}>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
              )}
              <div className="text-3xl">{t.icon}</div>
              <div className="mt-2 font-bold text-slate-900">{TYPE_LABELS[t.key]}</div>
              <div className="text-xs text-slate-500">{t.hint}</div>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                ⏱ مهلة الإنجاز: {slaLabel(t.key)}
              </div>
            </button>
          ))}
        </div>
      </Step>

      <Step n={2} title="المصدر والتحويل" done={!!teamId}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="source" required>مصدر الحالة</Label>
            <Select id="source" name="source" required defaultValue={defaultSource}>
              <option value="" disabled>اختر...</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="teamId" required>تُحوَّل إلى فريق</Label>
            <Select id="teamId" name="teamId" required value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="" disabled>اختر الفريق...</option>
              {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
        </div>
      </Step>

      <Step n={3} title="بيانات المستفيد">
        <DetailsFields />
      </Step>

      <Step n={4} title="المرفقات" optional>
        <Label htmlFor="files">صور، PDF، Word، Excel — حتى 5 ملفات، بحد أقصى 10 ميجابايت للملف</Label>
        <FileInput id="files" />
      </Step>

      {error && <div className="animate-expand rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur lg:bottom-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          {type ? (
            <span className="animate-fade inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              {TYPES.find((t) => t.key === type)?.icon} {TYPE_LABELS[type]} · {slaLabel(type)}
            </span>
          ) : <span className="text-slate-400">اختر نوع الحالة أولًا</span>}
          {team && (
            <span className="animate-fade inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              ← <span className="h-2 w-2 rounded-full" style={{ background: team.color }} />{team.name}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>إلغاء</Button>
          <Button type="submit" size="lg" disabled={!type} loading={pending}>حفظ وتحويل</Button>
        </div>
      </div>
    </form>
  );
}

function Step({ n, title, done, optional, children }: {
  n: number; title: string; done?: boolean; optional?: boolean; children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-3 font-bold text-slate-900">
        <span className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-300",
          done ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500",
        )}>
          {done ? <svg viewBox="0 0 24 24" className="animate-check h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : n}
        </span>
        {title}
        {optional && <span className="text-xs font-normal text-slate-400">(اختياري)</span>}
      </h2>
      {children}
    </section>
  );
}
