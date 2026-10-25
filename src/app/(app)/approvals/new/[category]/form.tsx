"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field, Label } from "@/components/ui/form";
import { createApproval } from "@/actions/approvals";
import type { ApprovalCategory } from "@prisma/client";

type ExtraField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  required?: boolean;
  options?: string[];
};

export function ApprovalForm({ category, accentColor, extraFields }: {
  category: ApprovalCategory;
  accentColor: string;
  extraFields: ExtraField[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setLoading(true);
    const fd = new FormData(e.currentTarget);

    // فصل الحقول العامة عن الحقول الخاصة (extra)
    const commonKeys = ["caseCode", "patientName", "specialty", "service", "month", "prescriptionLink", "prescriptionDate", "uploaderNotes"];
    const payload: any = { category, extra: {} };
    for (const [k, v] of fd.entries()) {
      const val = typeof v === "string" ? v.trim() : v;
      if (commonKeys.includes(k)) payload[k] = val || null;
      else payload.extra[k] = val || null;
    }

    const res = await createApproval(payload);
    setLoading(false);
    if (res.ok) router.push(`/approvals/${res.approvalId}`);
    else setError(res.error ?? "خطأ غير متوقع");
  }

  return (
    <form onSubmit={onSubmit} className="card p-6 space-y-4">
      {/* الحقول الأساسية المشتركة */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field className="mb-0">
          <Label required htmlFor="caseCode">كود الحالة</Label>
          <Input id="caseCode" name="caseCode" required placeholder="مثال: 111725" dir="ltr" />
        </Field>
        <Field className="mb-0">
          <Label required htmlFor="patientName">اسم المريض</Label>
          <Input id="patientName" name="patientName" required placeholder="الاسم الكامل" />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field className="mb-0">
          <Label htmlFor="service">الخدمة</Label>
          <Select id="service" name="service" defaultValue="علاج">
            <option value="علاج">علاج</option>
            <option value="فحوصات">فحوصات</option>
            <option value="متابعة">متابعة</option>
            <option value="عملية">عملية</option>
            <option value="مستلزمات">مستلزمات</option>
            <option value="أخرى">أخرى</option>
          </Select>
        </Field>
        <Field className="mb-0">
          <Label htmlFor="month">الشهر</Label>
          <Select id="month" name="month" defaultValue="">
            <option value="">— اختر —</option>
            {["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field className="mb-0">
          <Label htmlFor="prescriptionLink">لينك الروشتة / التقرير</Label>
          <Input id="prescriptionLink" name="prescriptionLink" type="url" placeholder="https://..." dir="ltr" />
        </Field>
        <Field className="mb-0">
          <Label htmlFor="prescriptionDate">تاريخ الروشتة / التقرير</Label>
          <Input id="prescriptionDate" name="prescriptionDate" type="date" dir="ltr" />
        </Field>
      </div>

      {/* حقول خاصة بالفئة */}
      {extraFields.length > 0 && (
        <>
          <div className="border-t border-slate-100 pt-4">
            <div className="mb-3 text-sm font-semibold text-slate-700">حقول خاصة</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {extraFields.map((f) => (
                <Field key={f.key} className={f.type === "textarea" ? "mb-0 md:col-span-2" : "mb-0"}>
                  <Label htmlFor={f.key} required={f.required}>{f.label}</Label>
                  {f.type === "textarea" ? (
                    <Textarea id={f.key} name={f.key} required={f.required} />
                  ) : f.type === "select" ? (
                    <Select id={f.key} name={f.key} required={f.required} defaultValue="">
                      <option value="">— اختر —</option>
                      {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </Select>
                  ) : (
                    <Input id={f.key} name={f.key} required={f.required} />
                  )}
                </Field>
              ))}
            </div>
          </div>
        </>
      )}

      <Field className="mb-0">
        <Label htmlFor="uploaderNotes">ملاحظات القائم بالرفع</Label>
        <Textarea id="uploaderNotes" name="uploaderNotes" placeholder="ملاحظات إضافية اختيارية..." />
      </Field>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow disabled:opacity-60"
          style={{ background: accentColor }}
        >
          {loading ? "جاري الحفظ..." : "إنشاء الموافقة"}
        </button>
        <Button type="button" variant="secondary" onClick={() => router.push("/approvals/new")}>رجوع</Button>
      </div>
    </form>
  );
}
