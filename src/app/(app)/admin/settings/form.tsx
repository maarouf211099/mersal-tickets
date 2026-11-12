"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettings } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { TYPE_LABELS, minutesLabel, type TicketType } from "@/lib/workflow";

type S = {
  sla: Record<TicketType, number>;
  closeCategories: string[];
  announcement: { text: string; tone: "info" | "warning" | "danger"; active: boolean };
};
const TYPES: { key: TicketType; icon: string }[] = [{ key: "emergency", icon: "🚨" }, { key: "new_case", icon: "🆕" }, { key: "follow_up", icon: "📋" }];
const TONE: Record<string, string> = {
  info: "border-brand-200 bg-brand-50 text-brand-900", warning: "border-amber-200 bg-amber-50 text-amber-900", danger: "border-red-200 bg-red-50 text-red-900",
};

export function SettingsForm({ initial }: { initial: S }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // المهلة بتتكتب بوحدة مريحة: دقايق للأقل من ساعة، وساعات للباقي
  const [sla, setSla] = useState(() => Object.fromEntries(TYPES.map(({ key }) => {
    const m = initial.sla[key];
    return [key, m % 60 === 0 ? { n: String(m / 60), unit: "h" } : { n: String(m), unit: "m" }];
  })) as Record<TicketType, { n: string; unit: string }>);
  const [cats, setCats] = useState(initial.closeCategories);
  const [newCat, setNewCat] = useState("");
  const [ann, setAnn] = useState(initial.announcement);
  const minutes = (k: TicketType) => Math.round(Number(sla[k].n) * (sla[k].unit === "h" ? 60 : 1));

  function addCat() {
    const v = newCat.trim();
    if (v.length < 2) return;
    if (cats.includes(v)) { toast("السبب موجود بالفعل", "error"); return; }
    setCats([...cats, v]); setNewCat("");
  }
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= cats.length) return;
    const c = [...cats]; [c[i], c[j]] = [c[j], c[i]]; setCats(c);
  };

  function save() {
    for (const { key } of TYPES) if (!(minutes(key) >= 1)) { toast(`مهلة «${TYPE_LABELS[key]}» غير صحيحة`, "error"); return; }
    start(async () => {
      const r = await saveSettings({
        sla: { emergency: minutes("emergency"), new_case: minutes("new_case"), follow_up: minutes("follow_up") },
        closeCategories: cats, announcement: ann,
      });
      if (!r.ok) { toast(r.error, "error"); return; }
      toast("تم حفظ الإعدادات");
      router.refresh();
    });
  }

  return (
    <div className="stagger space-y-5">
      <section className="card p-5">
        <h2 className="mb-1 font-bold text-slate-900">⏱ مهلة الإنجاز (SLA)</h2>
        <p className="mb-4 text-sm text-slate-500">تُطبَّق على التذاكر التي تُنشأ بعد الحفظ. التذاكر الحالية تحتفظ بمهلتها.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TYPES.map(({ key, icon }) => (
            <div key={key} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <Label>{icon} {TYPE_LABELS[key]}</Label>
              <div className="flex gap-2">
                <Input type="number" min={1} dir="ltr" value={sla[key].n} onChange={(e) => setSla({ ...sla, [key]: { ...sla[key], n: e.target.value } })} />
                <Select value={sla[key].unit} onChange={(e) => setSla({ ...sla, [key]: { ...sla[key], unit: e.target.value } })} className="w-28">
                  <option value="m">دقيقة</option><option value="h">ساعة</option>
                </Select>
              </div>
              <div className="mt-1.5 text-xs text-slate-500">= {minutes(key) >= 1 ? minutesLabel(minutes(key)) : "—"}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">ملاحظة: تذكرة الطوارئ المحوَّلة إلى «التسجيل والاتصال الخارجي» تبقى مهلتها 48 ساعة من وقت التحويل.</p>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-bold text-slate-900">✅ أسباب إغلاق التذكرة</h2>
        <p className="mb-4 text-sm text-slate-500">القائمة التي يختار منها الموظف عند الإغلاق. الترتيب هنا هو ترتيب ظهورها.</p>
        <ul className="space-y-1.5">
          {cats.map((c, i) => (
            <li key={c} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{c}</span>
              <button type="button" aria-label="لأعلى" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-md px-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">▲</button>
              <button type="button" aria-label="لأسفل" disabled={i === cats.length - 1} onClick={() => move(i, 1)} className="rounded-md px-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">▼</button>
              <button type="button" aria-label="حذف" disabled={cats.length === 1} onClick={() => setCats(cats.filter((x) => x !== c))} className="rounded-md px-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">✕</button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={80} placeholder="سبب جديد…"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCat(); } }} />
          <Button type="button" variant="secondary" onClick={addCat} disabled={newCat.trim().length < 2}>إضافة</Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">حذف سبب لا يغيّر التذاكر التي أُغلقت به من قبل.</p>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-bold text-slate-900">📢 إعلان لكل المستخدمين</h2>
        <p className="mb-4 text-sm text-slate-500">يظهر شريطًا أعلى كل الصفحات لكل من يسجّل الدخول.</p>
        <Textarea value={ann.text} onChange={(e) => setAnn({ ...ann, text: e.target.value })} maxLength={300} placeholder="مثال: صيانة للنظام اليوم الساعة 10 مساءً لمدة نصف ساعة" className="min-h-[70px]" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Select value={ann.tone} onChange={(e) => setAnn({ ...ann, tone: e.target.value as S["announcement"]["tone"] })} className="w-40">
            <option value="info">معلومة (أخضر)</option><option value="warning">تنبيه (أصفر)</option><option value="danger">مهم (أحمر)</option>
          </Select>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={ann.active} onChange={(e) => setAnn({ ...ann, active: e.target.checked })} /> إظهار الإعلان الآن
          </label>
        </div>
        {ann.text.trim() && (
          <div className={`mt-3 rounded-xl border px-4 py-2.5 text-sm ${TONE[ann.tone]} ${ann.active ? "" : "opacity-50"}`}>
            📢 {ann.text} {!ann.active && <span className="text-xs">(معاينة — غير ظاهر)</span>}
          </div>
        )}
      </section>

      <div className="sticky bottom-20 z-10 flex justify-end rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur lg:bottom-4">
        <Button size="lg" loading={pending} onClick={save}>حفظ الإعدادات</Button>
      </div>
    </div>
  );
}
