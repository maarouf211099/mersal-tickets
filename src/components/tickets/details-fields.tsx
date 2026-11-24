"use client";
import { useRef, useState, useTransition } from "react";
import { lookupCasePatient } from "@/actions/devices";
import { toast } from "@/components/ui/toast";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { EGYPTIAN, GENDERS, NATIONALITIES, RELATIONSHIPS } from "@/lib/workflow";

export type DetailsDefaults = {
  beneficiaryName?: string; phone1?: string; phone2?: string | null; caseCode?: string | null;
  relationship?: string; nationality?: string; nationalId?: string | null; unhcrNumber?: string | null;
  description?: string | null; age?: number | null; gender?: string | null; location?: string | null;
};

// بيانات المستفيد — مشتركة بين فورم الإنشاء وفورم التعديل
export function DetailsFields({ d = {}, casesOn = false }: { d?: DetailsDefaults; casesOn?: boolean }) {
  const known = !d.nationality || NATIONALITIES.includes(d.nationality);
  const [nationality, setNationality] = useState(known ? (d.nationality ?? "") : "أخرى");
  const egyptian = nationality === EGYPTIAN;
  const root = useRef<HTMLDivElement>(null);
  const [fetching, startFetch] = useTransition();
  const [filled, setFilled] = useState(0);

  // جلب بيانات الحالة من سيستم الحالات بالكود — بيملا الخانات وكل حاجة تفضل قابلة للتعديل
  function setField(name: string, value: string | number | null | undefined) {
    if (value === null || value === undefined || value === "") return false;
    const el = root.current?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`);
    if (!el) return false;
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.classList.add("!bg-sky-50", "!border-sky-300");
    return true;
  }
  function fetchCase() {
    const code = root.current?.querySelector<HTMLInputElement>('[name="caseCode"]')?.value.trim();
    if (!code) { toast("اكتب كود الحالة الأول", "error"); return; }
    startFetch(async () => {
      const r = await lookupCasePatient(code);
      if (!r.ok) { toast(r.error, "error"); return; }
      const p = r.data;
      let n = 0;
      const set = (k: string, v: string | number | null | undefined) => { if (setField(k, v)) n++; };
      set("beneficiaryName", p.name); set("age", p.age); set("gender", p.gender);
      set("phone1", p.phone1); set("phone2", p.phone2);
      set("location", [p.governorate, p.city, p.area, p.address].filter(Boolean).join(" — "));
      if (p.nationality) {
        const isKnown = NATIONALITIES.includes(p.nationality);
        setNationality(isKnown ? p.nationality : "أخرى");
        if (!isKnown) setTimeout(() => setField("nationalityOther", p.nationality), 0);
        n++;
      }
      const desc = root.current?.querySelector<HTMLTextAreaElement>('[name="description"]');
      if (p.lastDecision && desc && !desc.value.trim()) {
        set("description", `آخر قرار اجتماعي${p.lastDecisionDate ? ` (${p.lastDecisionDate})` : ""}: ${p.lastDecision}`);
      }
      setFilled(n);
      toast(n ? `اتجابت بيانات ${p.name || "الحالة"} من سيستم الحالات — راجعها وعدّل لو محتاج` : "الكود اتلقى بس مفيش بيانات تتملا");
    });
  }

  return (
    <div ref={root} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2 rounded-xl border border-sky-200 bg-sky-50/40 p-3">
        <Label htmlFor="caseCode">كود الحالة {casesOn && <span className="text-xs font-normal text-slate-500">— اكتبه الأول ودوس Enter أو «جلب» علشان باقي البيانات تتملا لوحدها</span>}</Label>
        <div className="flex gap-2">
          <Input id="caseCode" name="caseCode" dir="ltr" defaultValue={d.caseCode ?? ""} placeholder="مثلًا 12345" className="bg-white"
            onKeyDown={(e) => { if (casesOn && e.key === "Enter") { e.preventDefault(); fetchCase(); } }} />
          {casesOn && (
            <button type="button" onClick={fetchCase} disabled={fetching} title="يجيب الاسم والسن والنوع والتليفونات والعنوان والجنسية وآخر قرار"
              className="shrink-0 whitespace-nowrap rounded-lg border border-sky-300 bg-sky-50 px-3 text-sm font-medium text-sky-800 transition hover:bg-sky-100 disabled:opacity-60">
              {fetching ? "جاري الجلب…" : "🔎 جلب من سيستم الحالات"}
            </button>
          )}
        </div>
        {filled > 0 && <p className="mt-1 text-xs text-sky-700">الخانات الملوّنة اتملت من سيستم الحالات — تقدر تعدّل أي حاجة.</p>}
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="beneficiaryName" required>الاسم</Label>
        <Input id="beneficiaryName" name="beneficiaryName" required defaultValue={d.beneficiaryName} />
      </div>
      <div>
        <Label htmlFor="age">السن</Label>
        <Input id="age" name="age" type="number" min={0} max={120} inputMode="numeric" dir="ltr" defaultValue={d.age ?? ""} />
      </div>
      <div>
        <Label htmlFor="gender">النوع</Label>
        <Select id="gender" name="gender" defaultValue={d.gender ?? ""}>
          <option value="">اختر...</option>
          {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="location">مكان الحالة</Label>
        <Input id="location" name="location" maxLength={200} placeholder="المحافظة / المنطقة / العنوان" defaultValue={d.location ?? ""} />
      </div>
      <div>
        <Label htmlFor="phone1" required>رقم الهاتف الأول</Label>
        <Input id="phone1" name="phone1" required inputMode="tel" dir="ltr" defaultValue={d.phone1} />
      </div>
      <div>
        <Label htmlFor="phone2">رقم الهاتف الثاني</Label>
        <Input id="phone2" name="phone2" inputMode="tel" dir="ltr" defaultValue={d.phone2 ?? ""} />
      </div>
      <div>
        <Label htmlFor="relationship" required>صلة القرابة</Label>
        <Select id="relationship" name="relationship" required defaultValue={d.relationship ?? ""}>
          <option value="" disabled>اختر...</option>
          {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
          {d.relationship && !RELATIONSHIPS.includes(d.relationship) && <option value={d.relationship}>{d.relationship}</option>}
        </Select>
      </div>
      <div>
        <Label htmlFor="nationality" required>الجنسية</Label>
        <Select id="nationality" name="nationality" required value={nationality} onChange={(e) => setNationality(e.target.value)}>
          <option value="" disabled>اختر...</option>
          {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
        {nationality === "أخرى" && (
          <Input name="nationalityOther" className="mt-2" placeholder="اكتب الجنسية" required defaultValue={known ? "" : d.nationality} />
        )}
      </div>
      {nationality && (egyptian ? (
        <div>
          <Label htmlFor="nationalId">الرقم القومي (14 رقمًا — اختياري)</Label>
          <Input id="nationalId" name="nationalId" inputMode="numeric" dir="ltr" maxLength={20} defaultValue={d.nationalId ?? ""} />
        </div>
      ) : (
        <div>
          <Label htmlFor="unhcrNumber">رقم المفوضية (اختياري)</Label>
          <Input id="unhcrNumber" name="unhcrNumber" dir="ltr" defaultValue={d.unhcrNumber ?? ""} />
        </div>
      ))}
      <div className="md:col-span-2">
        <Label htmlFor="description">تفاصيل الحالة</Label>
        <Textarea id="description" name="description" defaultValue={d.description ?? ""} />
      </div>
    </div>
  );
}
