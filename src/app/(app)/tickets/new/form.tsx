"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTicket } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/form";
import { DetailsFields } from "@/components/tickets/details-fields";
import { SLA_MINUTES, SOURCE_LABELS, TYPE_LABELS, type TicketType } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { FileInput } from "@/components/ui/file-input";

const TYPES: { key: TicketType; icon: string; cls: string }[] = [
  { key: "emergency", icon: "🚨", cls: "border-red-300 bg-red-50 text-red-800" },
  { key: "new_case", icon: "🆕", cls: "border-violet-300 bg-violet-50 text-violet-800" },
  { key: "follow_up", icon: "📋", cls: "border-brand-300 bg-brand-50 text-brand-800" },
];

function slaText(t: TicketType) {
  const m = SLA_MINUTES[t];
  return m < 60 ? `${m} دقيقة` : `${m / 60} ساعة`;
}

export function NewTicketForm({ targets, defaultSource }: {
  targets: { id: string; name: string; color: string }[];
  defaultSource: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<TicketType | "">("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await createTicket(form);
      if (r.ok) router.push(`/tickets/${r.id}`);
      else setError(r.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="card p-5">
        <h2 className="mb-3 font-semibold text-slate-900">نوع الحالة</h2>
        <input type="hidden" name="type" value={type} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TYPES.map((t) => (
            <button key={t.key} type="button" onClick={() => setType(t.key)}
              className={cn(
                "rounded-xl border-2 p-4 text-right transition",
                type === t.key ? t.cls + " shadow-md" : "border-slate-200 bg-white hover:border-slate-300",
              )}>
              <div className="text-2xl">{t.icon}</div>
              <div className="mt-1 font-bold">{TYPE_LABELS[t.key]}</div>
              <div className="text-xs text-slate-500">مهلة الإنجاز: {slaText(t.key)}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
        <div>
          <Label htmlFor="source" required>مصدر الحالة</Label>
          <Select id="source" name="source" required defaultValue={defaultSource}>
            <option value="" disabled>اختر...</option>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="teamId" required>تُحوَّل إلى فريق</Label>
          <Select id="teamId" name="teamId" required defaultValue="">
            <option value="" disabled>اختر الفريق...</option>
            {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 font-semibold text-slate-900">بيانات المستفيد</h2>
        <DetailsFields />
      </div>

      <div className="card p-5">
        <Label htmlFor="files">المرفقات (صور، PDF، Word، Excel — حتى 5 ملفات، بحد أقصى 10 ميجابايت للملف)</Label>
        <FileInput id="files" />
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>إلغاء</Button>
        <Button type="submit" disabled={pending || !type}>{pending ? "جاري الحفظ..." : "حفظ وتحويل"}</Button>
      </div>
    </form>
  );
}
