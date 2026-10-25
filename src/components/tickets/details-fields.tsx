"use client";
import { useState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { EGYPTIAN, NATIONALITIES, RELATIONSHIPS } from "@/lib/workflow";

export type DetailsDefaults = {
  beneficiaryName?: string; phone1?: string; phone2?: string | null; caseCode?: string | null;
  relationship?: string; nationality?: string; nationalId?: string | null; unhcrNumber?: string | null;
  description?: string | null;
};

// بيانات المستفيد — مشتركة بين فورم الإنشاء وفورم التعديل
export function DetailsFields({ d = {} }: { d?: DetailsDefaults }) {
  const known = !d.nationality || NATIONALITIES.includes(d.nationality);
  const [nationality, setNationality] = useState(known ? (d.nationality ?? "") : "أخرى");
  const egyptian = nationality === EGYPTIAN;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <Label htmlFor="beneficiaryName" required>الاسم</Label>
        <Input id="beneficiaryName" name="beneficiaryName" required defaultValue={d.beneficiaryName} />
      </div>
      <div>
        <Label htmlFor="phone1" required>رقم الموبايل 1</Label>
        <Input id="phone1" name="phone1" required inputMode="tel" dir="ltr" defaultValue={d.phone1} />
      </div>
      <div>
        <Label htmlFor="phone2">رقم الموبايل 2</Label>
        <Input id="phone2" name="phone2" inputMode="tel" dir="ltr" defaultValue={d.phone2 ?? ""} />
      </div>
      <div>
        <Label htmlFor="caseCode">الكود</Label>
        <Input id="caseCode" name="caseCode" dir="ltr" defaultValue={d.caseCode ?? ""} />
      </div>
      <div>
        <Label htmlFor="relationship" required>صلة القرابة</Label>
        <Select id="relationship" name="relationship" required defaultValue={d.relationship ?? ""}>
          <option value="" disabled>اختار...</option>
          {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
          {d.relationship && !RELATIONSHIPS.includes(d.relationship) && <option value={d.relationship}>{d.relationship}</option>}
        </Select>
      </div>
      <div>
        <Label htmlFor="nationality" required>الجنسية</Label>
        <Select id="nationality" name="nationality" required value={nationality} onChange={(e) => setNationality(e.target.value)}>
          <option value="" disabled>اختار...</option>
          {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
        {nationality === "أخرى" && (
          <Input name="nationalityOther" className="mt-2" placeholder="اكتب الجنسية" required defaultValue={known ? "" : d.nationality} />
        )}
      </div>
      {nationality && (egyptian ? (
        <div>
          <Label htmlFor="nationalId" required>الرقم القومي (14 رقم)</Label>
          <Input id="nationalId" name="nationalId" required inputMode="numeric" dir="ltr" maxLength={20} defaultValue={d.nationalId ?? ""} />
        </div>
      ) : (
        <div>
          <Label htmlFor="unhcrNumber" required>رقم المفوضية</Label>
          <Input id="unhcrNumber" name="unhcrNumber" required dir="ltr" defaultValue={d.unhcrNumber ?? ""} />
        </div>
      ))}
      <div className="md:col-span-2">
        <Label htmlFor="description">تفاصيل الحالة</Label>
        <Textarea id="description" name="description" defaultValue={d.description ?? ""} />
      </div>
    </div>
  );
}
