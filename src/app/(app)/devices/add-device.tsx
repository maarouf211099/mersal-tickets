"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDevice } from "@/actions/devices";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { DEVICE_TYPES } from "@/lib/workflow";

// إضافة جهاز يدوي (للمدير) — بعد الحفظ الفورم بيفضل مفتوح بنفس النوع علشان تضيف اللي بعده بسرعة
export function AddDevice({ device, onDone }: {
  device?: { id: string; type: string; serial: string; internalPacking: string | null; notes: string | null }; onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!device);
  const [pending, start] = useTransition();
  const [f, setF] = useState({ type: device?.type ?? "", serial: device?.serial ?? "", internalPacking: device?.internalPacking ?? "", notes: device?.notes ?? "" });

  if (!open) return <Button onClick={() => setOpen(true)}>+ إضافة جهاز</Button>;
  return (
    <form className="card animate-expand space-y-3 border-brand-300 p-5" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await saveDevice(device?.id ?? null, f);
        if (!r.ok) { toast(r.error, "error"); return; }
        toast(device ? "تم حفظ التعديل" : `تمت إضافة ${f.type} — ${f.serial}`);
        if (device) { onDone?.(); } else setF({ ...f, serial: "", internalPacking: "", notes: "" });
        router.refresh();
      });
    }}>
      <h3 className="font-bold text-slate-900">{device ? "تعديل الجهاز" : "إضافة جهاز للمخزن"}</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div><Label required>نوع الجهاز</Label>
          <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} required>
            <option value="">اختر...</option>{DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </div>
        <div><Label required>السيريال</Label><Input value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} dir="ltr" required autoFocus={!device} /></div>
        <div><Label>رقم الـ Internal Packing</Label><Input value={f.internalPacking} onChange={(e) => setF({ ...f, internalPacking: e.target.value })} dir="ltr" /></div>
        <div><Label>ملاحظات</Label><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>{device ? "حفظ" : "إضافة"}</Button>
        <Button type="button" variant="ghost" onClick={() => (device ? onDone?.() : setOpen(false))}>{device ? "إلغاء" : "إغلاق"}</Button>
      </div>
    </form>
  );
}
