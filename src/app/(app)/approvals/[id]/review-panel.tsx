"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Textarea, Field, Label, Select, Input } from "@/components/ui/form";
import { reviewApproval } from "@/actions/approvals";

export function ReviewPanel({
  approvalId, currentStatus, currentWritten, currentType, accentColor,
}: {
  approvalId: string;
  currentStatus: string;
  currentWritten: string;
  currentType: string;
  accentColor: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState(currentStatus);
  const [written, setWritten] = useState(currentWritten);
  const [type, setType] = useState(currentType);
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await reviewApproval(approvalId, { status, writtenApproval: written, approvalType: type });
      if (res.ok) {
        setMsg("✓ تم حفظ القرار");
        router.refresh();
        setTimeout(() => setMsg(null), 3000);
      } else {
        setMsg(res.error ?? "خطأ");
      }
    });
  }

  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">قرار الطبيب</h3>
      <div className="space-y-3">
        <Field className="mb-0">
          <Label htmlFor="status">الحالة</Label>
          <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">في الانتظار</option>
            <option value="under_review">قيد المراجعة</option>
            <option value="approved">تمت الموافقة</option>
            <option value="rejected">مرفوضة</option>
            <option value="needs_info">تحتاج توضيحاً</option>
            <option value="dispensed">تم الصرف</option>
            <option value="closed">مقفولة</option>
          </Select>
        </Field>
        <Field className="mb-0">
          <Label htmlFor="type">نوع الموافقة</Label>
          <Select id="type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">— اختر —</option>
            <option value="شهري">شهري</option>
            <option value="عاجل">عاجل</option>
            <option value="استثنائي">استثنائي</option>
            <option value="قرار جديد">قرار جديد</option>
            <option value="غير عاجل">غير عاجل</option>
          </Select>
        </Field>
        <Field className="mb-0">
          <Label htmlFor="written">نص القرار</Label>
          <Textarea id="written" value={written} onChange={(e) => setWritten(e.target.value)}
                    placeholder="اكتب تفاصيل القرار الطبي..." className="min-h-[140px]" />
        </Field>
        {msg && (
          <div className={`rounded-lg px-3 py-2 text-sm ${msg.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {msg}
          </div>
        )}
        <button onClick={save} disabled={pending}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow disabled:opacity-60"
          style={{ background: accentColor }}>
          {pending ? "جاري الحفظ..." : "حفظ القرار"}
        </button>
      </div>
    </div>
  );
}
