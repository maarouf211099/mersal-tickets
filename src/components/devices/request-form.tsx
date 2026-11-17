"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDeviceRequest, lookupCasePatient, updateDeviceRequest } from "@/actions/devices";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { DEVICE_TYPES, GENDERS, NATIONALITIES, SOURCE_LABELS, ageGroup } from "@/lib/workflow";
import { GOVERNORATES } from "@/lib/ambulance-options";

export type DeviceRequestValues = {
  source: string; caseCode: string; beneficiaryName: string; nationality: string; gender: string; age: string;
  religion: string; governorate: string; area: string; city: string; address: string; phone1: string; phone2: string;
  deviceType: string; nursingVisit: string; nursingFrequency: string; socialDecision: string; socialDecisionEnd: string;
  hasContribution: string; contributionType: string; contributionAmount: string; notes: string;
};

export const EMPTY_REQUEST: DeviceRequestValues = {
  source: "", caseCode: "", beneficiaryName: "", nationality: "مصري", gender: "", age: "", religion: "",
  governorate: "", area: "", city: "", address: "", phone1: "", phone2: "", deviceType: "",
  nursingVisit: "no", nursingFrequency: "", socialDecision: "", socialDecisionEnd: "",
  hasContribution: "no", contributionType: "", contributionAmount: "", notes: "",
};

const RELIGIONS = ["مسلم", "مسيحي", "أخرى"];

// فورم طلب الجهاز — للإنشاء والتعديل. «جلب من سيستم الحالات» بيملا البيانات وكلها تفضل قابلة للتعديل.
export function DeviceRequestForm({ mode, ticketId, initial, stock, casesOn }: {
  mode: "create" | "edit"; ticketId?: string; initial: DeviceRequestValues;
  stock: Record<string, number>; casesOn: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [fetching, startFetch] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [filled, setFilled] = useState<string[]>([]);
  const set = (k: keyof DeviceRequestValues) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const group = ageGroup(v.age ? Number(v.age) : null);
  const mark = (k: string) => (filled.includes(k) ? "ring-2 ring-sky-200 bg-sky-50/40" : "");

  function fetchCase() {
    if (!v.caseCode.trim()) { toast("اكتب كود المريض الأول", "error"); return; }
    startFetch(async () => {
      const r = await lookupCasePatient(v.caseCode);
      if (!r.ok) { toast(r.error, "error"); return; }
      const d = r.data;
      const next: Partial<DeviceRequestValues> = {};
      const put = (k: keyof DeviceRequestValues, val: string | number | null) => { if (val != null && String(val).trim()) next[k] = String(val); };
      put("beneficiaryName", d.name); put("age", d.age); put("gender", d.gender); put("nationality", d.nationality);
      put("religion", d.religion); put("governorate", GOVERNORATES.find((g) => d.governorate?.includes(g.replace(/^ال/, ""))) ?? d.governorate);
      put("city", d.city); put("area", d.area); put("address", d.address); put("phone1", d.phone1); put("phone2", d.phone2);
      put("socialDecision", d.lastDecision);
      setV((x) => ({ ...x, ...next }));
      setFilled(Object.keys(next));
      toast(`تم جلب بيانات ${d.name || "المريض"} — راجعها وعدّل لو محتاج`);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData();
    for (const [k, val] of Object.entries(v)) fd.set(k, val);
    start(async () => {
      const r = mode === "create" ? await createDeviceRequest(fd) : await updateDeviceRequest(ticketId!, fd);
      if (!r.ok) { setErr(r.error); toast(r.error, "error"); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      toast(mode === "create" ? "تم إنشاء طلب الجهاز — اتحوّل لطبيب المتابعة" : "تم حفظ التعديلات");
      router.push(`/tickets/${"id" in r ? r.id : ticketId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="stagger space-y-5">
      {err && <div className="animate-expand rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

      <Section n={1} title="بيانات المريض">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label required>كود المريض</Label>
            <div className="flex gap-2">
              <Input value={v.caseCode} onChange={set("caseCode")} dir="ltr" required placeholder="مثلًا 12345"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fetchCase(); } }} />
              <Button type="button" variant="secondary" loading={fetching} disabled={!casesOn} onClick={fetchCase}
                title={casesOn ? "يجيب الاسم والسن والعنوان والهاتف وآخر قرار" : "ربط سيستم الحالات غير مفعّل على السيرفر"}>
                🔎 جلب من سيستم الحالات
              </Button>
            </div>
            {!casesOn && <p className="mt-1 text-xs text-amber-700">ربط سيستم الحالات غير مفعّل بعد — املأ البيانات يدويًا.</p>}
            {filled.length > 0 && <p className="mt-1 text-xs text-sky-700">الخانات الملوّنة اتملت من سيستم الحالات — تقدر تعدّل أي حاجة.</p>}
          </div>
          <div className="md:col-span-2"><Label required>الاسم</Label><Input value={v.beneficiaryName} onChange={set("beneficiaryName")} required className={mark("beneficiaryName")} /></div>
          <div><Label required>الجنسية</Label>
            <Input value={v.nationality} onChange={set("nationality")} list="nat-list" required className={mark("nationality")} />
            <datalist id="nat-list">{NATIONALITIES.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div><Label required>النوع</Label>
            <Select value={v.gender} onChange={set("gender")} required className={mark("gender")}>
              <option value="">اختر...</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}
            </Select>
          </div>
          <div><Label required>العمر بالسنوات</Label><Input type="number" min={0} max={120} dir="ltr" value={v.age} onChange={set("age")} required className={mark("age")} /></div>
          <div><Label>التصنيف العمري</Label>
            <div className={`flex h-[42px] items-center rounded-lg px-3.5 text-sm font-semibold ${group ? (group === "فوق السن" ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-800") : "bg-slate-50 text-slate-400"}`}>
              {group ?? "يُحسب من العمر"} {group && <span className="mr-1 text-xs font-normal opacity-70">(18 سنة)</span>}
            </div>
          </div>
          <div><Label>الديانة</Label>
            <Input value={v.religion} onChange={set("religion")} list="rel-list" className={mark("religion")} />
            <datalist id="rel-list">{RELIGIONS.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div><Label required>رقم الهاتف الأول</Label><Input type="tel" dir="ltr" value={v.phone1} onChange={set("phone1")} required className={mark("phone1")} /></div>
          <div><Label>رقم الهاتف الثاني</Label><Input type="tel" dir="ltr" value={v.phone2} onChange={set("phone2")} className={mark("phone2")} /></div>
          <div><Label required>مصدر الطلب</Label>
            <Select value={v.source} onChange={set("source")} required>
              <option value="">اختر...</option>{Object.entries(SOURCE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </div>
        </div>
      </Section>

      <Section n={2} title="العنوان">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div><Label required>المحافظة</Label>
            <Select value={v.governorate} onChange={set("governorate")} required className={mark("governorate")}>
              <option value="">اختر...</option>
              {v.governorate && !GOVERNORATES.includes(v.governorate) && <option>{v.governorate}</option>}
              {GOVERNORATES.map((g) => <option key={g}>{g}</option>)}
            </Select>
          </div>
          <div><Label>المدينة</Label><Input value={v.city} onChange={set("city")} className={mark("city")} /></div>
          <div><Label>المنطقة</Label><Input value={v.area} onChange={set("area")} className={mark("area")} /></div>
          <div className="md:col-span-3"><Label required>العنوان بالتفصيل</Label><Textarea value={v.address} onChange={set("address")} required className={`min-h-[60px] ${mark("address")}`} /></div>
        </div>
      </Section>

      <Section n={3} title="الجهاز المطلوب">
        <Label required>نوع الجهاز</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DEVICE_TYPES.map((t) => {
            const n = stock[t] ?? 0;
            const on = v.deviceType === t;
            return (
              <label key={t} className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border-2 px-3 py-2.5 text-sm transition-all ${on ? "border-sky-500 bg-sky-50 shadow-md shadow-sky-500/10" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                <span className="flex items-center gap-2">
                  <input type="radio" name="deviceType" value={t} checked={on} onChange={set("deviceType")} className="accent-sky-600" required />
                  <span className="font-medium text-slate-800">{t}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${n > 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
                  {n > 0 ? `متوفر ${n}` : "غير متوفر"}
                </span>
              </label>
            );
          })}
        </div>
        {v.deviceType && !(stock[v.deviceType] > 0) && (
          <p className="animate-expand mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">الجهاز غير متوفر حاليًا — الطلب هيتعمل عادي، وبعد الموافقات هيروح للمشتريات لحد ما يتوفر.</p>
        )}
      </Section>

      <Section n={4} title="الزيارة التمريضية والقرار الاجتماعي والمساهمة">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label required>هل يحتاج زيارة تمريضية؟</Label>
            <YesNo value={v.nursingVisit} onChange={(x) => setV((s) => ({ ...s, nursingVisit: x }))} />
            {v.nursingVisit === "yes" && (
              <Input className="animate-expand mt-2" value={v.nursingFrequency} onChange={set("nursingFrequency")} placeholder="كل قد إيه؟ مثلًا: مرة كل أسبوع" required />
            )}
          </div>
          <div>
            <Label required>هل توجد مساهمة مع المريض؟</Label>
            <YesNo value={v.hasContribution} onChange={(x) => setV((s) => ({ ...s, hasContribution: x }))} />
            {v.hasContribution === "yes" && (
              <div className="animate-expand mt-2 grid grid-cols-2 gap-2">
                <Select value={v.contributionType} onChange={set("contributionType")} required aria-label="نوع المساهمة">
                  <option value="">نوع المساهمة...</option><option>دورية</option><option>مرة واحدة</option>
                </Select>
                <Input type="number" min={0} step="0.01" dir="ltr" value={v.contributionAmount} onChange={set("contributionAmount")} placeholder="المبلغ (ج)" required />
              </div>
            )}
          </div>
          <div className="md:col-span-2"><Label>آخر قرار اجتماعي</Label><Textarea value={v.socialDecision} onChange={set("socialDecision")} className={`min-h-[60px] ${mark("socialDecision")}`} /></div>
          <div><Label>تاريخ نهاية القرار الاجتماعي</Label><Input type="date" dir="ltr" value={v.socialDecisionEnd} onChange={set("socialDecisionEnd")} /></div>
          <div className="md:col-span-2"><Label>ملاحظات</Label><Textarea value={v.notes} onChange={set("notes")} className="min-h-[60px]" /></div>
        </div>
      </Section>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur lg:bottom-4">
        <span className="text-sm text-slate-600">
          {v.deviceType ? <>🩺 <b>{v.deviceType}</b>{v.beneficiaryName && <> — {v.beneficiaryName}</>}</> : <span className="text-slate-400">اختر نوع الجهاز</span>}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>إلغاء</Button>
          <Button type="submit" size="lg" loading={pending}>{mode === "create" ? "إرسال الطلب لطبيب المتابعة" : "حفظ التعديلات"}</Button>
        </div>
      </div>
    </form>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-3 font-bold text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">{n}</span>{title}
      </h2>
      {children}
    </section>
  );
}

function YesNo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {[["yes", "نعم"], ["no", "لا"]].map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k}
          className={`rounded-lg border px-5 py-2 text-sm transition ${value === k ? "border-sky-500 bg-sky-50 font-semibold text-sky-800" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{l}</button>
      ))}
    </div>
  );
}
