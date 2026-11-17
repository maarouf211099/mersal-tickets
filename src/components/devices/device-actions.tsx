"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deliverDevice, deviceDecision, markStockReady, returnDevice } from "@/actions/devices";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";

type Stage = "doctor_review" | "research_review" | "decisions_review" | "awaiting_stock" | "awaiting_delivery" | "with_patient" | "returned" | "cancelled";

// أزرار مرحلة طلب الجهاز — كل فريق بيشوف الإجراء بتاعه بس
export function DeviceActions({ ticketId, stage, canDecide, canProcure, canWarehouse, canEdit, available, deviceType }: {
  ticketId: string; stage: Stage; canDecide: boolean; canProcure: boolean; canWarehouse: boolean; canEdit: boolean;
  available: { id: string; serial: string; internalPacking: string | null }[]; deviceType: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [deviceId, setDeviceId] = useState("");

  function run(key: string, ok: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    start(async () => {
      const r = await fn();
      setBusy(null);
      if (!r.ok) { toast(r.error ?? "حدث خطأ", "error"); return; }
      toast(ok); setNote(""); setDeviceId(""); router.refresh();
    });
  }

  const review = stage === "doctor_review" || stage === "research_review" || stage === "decisions_review";
  const reviewer = { doctor_review: "طبيب المتابعة", research_review: "الأبحاث", decisions_review: "قرارات مرسال" }[stage as "doctor_review"];
  const nothing = !(review && canDecide) && !(stage === "awaiting_stock" && (canProcure || canWarehouse))
    && !((stage === "awaiting_delivery" || stage === "awaiting_stock") && canWarehouse) && !(stage === "with_patient" && canWarehouse);

  return (
    <div className="card overflow-hidden border-sky-200">
      <div className="bg-gradient-to-l from-sky-600 to-cyan-500 px-4 py-3 text-white">
        <div className="text-sm font-bold">🩺 إجراءات طلب الجهاز</div>
        <div className="text-xs text-sky-50/90">{deviceType}</div>
      </div>
      <div className="space-y-3 p-4">
        {review && canDecide && (
          <>
            <p className="text-sm text-slate-600">القرار في المرحلة دي لـ<b>{reviewer}</b>.</p>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (إلزامية في حالة الرفض)" className="min-h-[60px]" />
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" loading={busy === "approve"} disabled={pending} onClick={() => run("approve", "تمت الموافقة", () => deviceDecision(ticketId, "approve", note))}>✅ موافقة</Button>
              <Button type="button" variant="danger" loading={busy === "reject"} disabled={pending || note.trim().length < 3}
                onClick={() => {
                  if (!confirm(stage === "doctor_review" ? "رفض الطبيب هيلغي الطلب ويقفل التذكرة. متأكد؟" : "الطلب هيرجع لطبيب المتابعة. متأكد؟")) return;
                  run("reject", stage === "doctor_review" ? "تم رفض الطلب" : "رجع الطلب لطبيب المتابعة", () => deviceDecision(ticketId, "reject", note));
                }}>❌ رفض</Button>
            </div>
            {stage !== "doctor_review" && <p className="text-xs text-slate-500">الرفض هنا بيرجّع الطلب لطبيب المتابعة.</p>}
          </>
        )}

        {stage === "awaiting_stock" && (canProcure || canWarehouse) && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            الجهاز غير متوفر في المخزن. بعد الشراء، أضِف الجهاز من <Link href="/devices" className="font-semibold underline">صفحة الأجهزة</Link> واضغط «الجهاز اتوفر».
            <Button type="button" variant="secondary" className="mt-2 w-full" loading={busy === "ready"} disabled={pending || available.length === 0}
              onClick={() => run("ready", "الطلب اتحوّل للمخزن للصرف", () => markStockReady(ticketId))}>
              📦 الجهاز اتوفر — حوّل للمخزن {available.length > 0 && `(${available.length} متاح)`}
            </Button>
          </div>
        )}

        {(stage === "awaiting_delivery" || stage === "awaiting_stock") && canWarehouse && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">صرف جهاز للمريض</p>
            {available.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">لا يوجد «{deviceType}» في المخزن حاليًا.</p>
            ) : (
              <>
                <Select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} aria-label="الجهاز">
                  <option value="">اختر الجهاز بالسيريال…</option>
                  {available.map((d) => <option key={d.id} value={d.id}>{d.serial}{d.internalPacking ? ` — IP ${d.internalPacking}` : ""}</option>)}
                </Select>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة الصرف (اختياري)" className="min-h-[50px]" />
                <Button type="button" className="w-full" loading={busy === "deliver"} disabled={pending || !deviceId}
                  onClick={() => run("deliver", "تم صرف الجهاز للمريض", () => deliverDevice(ticketId, deviceId, note))}>🩺 صرف الجهاز</Button>
              </>
            )}
          </div>
        )}

        {stage === "with_patient" && canWarehouse && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">لما الجهاز يرجع من المريض اضغط «استلام»: هيتحوّل للهندسية للفحص والتذكرة هتتقفل.</p>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="حالة الجهاز عند الاستلام (اختياري)" className="min-h-[50px]" />
            <Button type="button" variant="secondary" className="w-full" loading={busy === "return"} disabled={pending}
              onClick={() => { if (confirm("تأكيد استلام الجهاز من المريض؟")) run("return", "تم استلام الجهاز — اتحوّل للهندسية", () => returnDevice(ticketId, note)); }}>
              ↩ استلام الجهاز من المريض
            </Button>
          </div>
        )}

        {nothing && <p className="text-sm text-slate-500">لا يوجد إجراء مطلوب منك في المرحلة دي.</p>}

        {canEdit && (
          <Link href={`/tickets/${ticketId}/device-edit`} className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
            ✏️ تعديل بيانات الطلب
          </Link>
        )}
      </div>
    </div>
  );
}
