"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkAssign } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { displayName } from "@/lib/utils";

const boxes = () => [...document.querySelectorAll<HTMLInputElement>("input[data-bulk]")];

// توزيع جماعي للمشرف: يعلّم على التذاكر من الجدول ويختار موظف (أو بالتساوي على الفريق)
export function BulkAssign({ members }: { members: { id: string; fullName: string; open: number }[] }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [to, setTo] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    const sync = () => setCount(boxes().filter((b) => b.checked).length);
    document.addEventListener("change", sync);
    return () => document.removeEventListener("change", sync);
  }, []);

  const setAll = (v: boolean) => { boxes().forEach((b) => { b.checked = v; }); setCount(v ? boxes().length : 0); };

  function submit() {
    const ids = boxes().filter((b) => b.checked).map((b) => b.value);
    if (!ids.length || !to) return;
    start(async () => {
      const r = await bulkAssign(ids, to);
      if (!r.ok) { toast(r.error, "error"); return; }
      toast(r.warning ?? "تم التوزيع");
      setAll(false); setTo(""); router.refresh();
    });
  }

  return (
    <div className="card-glass sticky top-[84px] z-30 hidden flex-wrap items-center gap-3 p-3 md:flex">
      <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        👥 توزيع جماعي
        <span className={`rounded-full px-2.5 py-0.5 text-xs tabular-nums ${count ? "bg-ink-800 text-white" : "bg-slate-100 text-slate-500"}`}>{count} محددة</span>
      </span>
      <button type="button" onClick={() => setAll(true)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50">تحديد الكل</button>
      {count > 0 && <button type="button" onClick={() => setAll(false)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">إلغاء التحديد</button>}
      <div className="flex-1" />
      <Select value={to} onChange={(e) => setTo(e.target.value)} className="w-64" aria-label="الموظف">
        <option value="">وزّع على…</option>
        <option value="even">⚖️ بالتساوي على موظفي الفريق</option>
        {members.map((m) => <option key={m.id} value={m.id}>{displayName(m.fullName)} — عنده {m.open}</option>)}
      </Select>
      <Button type="button" loading={pending} disabled={!count || !to} onClick={submit}>توزيع {count > 0 && `(${count})`}</Button>
    </div>
  );
}
