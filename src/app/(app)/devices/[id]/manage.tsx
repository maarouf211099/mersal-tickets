"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeDeviceStatus, deleteDevice } from "@/actions/devices";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import type { DeviceStatus } from "@/lib/workflow";
import { AddDevice } from "../add-device";

export function DeviceManage({ device, moves, isManager, canDelete }: {
  device: { id: string; type: string; serial: string; internalPacking: string | null; notes: string | null };
  moves: { to: DeviceStatus; label: string; note: boolean }[]; isManager: boolean; canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (editing) return <AddDevice device={device} onDone={() => setEditing(false)} />;
  return (
    <div className="card space-y-3 p-4">
      <h3 className="font-bold text-slate-900">الإجراءات</h3>
      {moves.length > 0 ? (
        <>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (العطل، نتيجة الفحص…)" className="min-h-[60px]" />
          {moves.map((m) => (
            <Button key={m.to} type="button" variant="secondary" className="w-full" loading={busy === m.to} disabled={pending || (m.note && note.trim().length < 3)}
              onClick={() => { setBusy(m.to); start(async () => {
                const r = await changeDeviceStatus(device.id, m.to, note);
                setBusy(null);
                if (!r.ok) { toast(r.error, "error"); return; }
                toast("تم تحديث حالة الجهاز"); setNote(""); router.refresh();
              }); }}>{m.label}</Button>
          ))}
          {moves.some((m) => m.note) && <p className="text-xs text-slate-500">«بره الاستوك» محتاج ملاحظة بالسبب.</p>}
        </>
      ) : <p className="text-sm text-slate-500">لا يوجد إجراء متاح لك على الجهاز في حالته الحالية.</p>}
      {isManager && (
        <div className="flex gap-2 border-t border-slate-100 pt-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={() => setEditing(true)}>✏️ تعديل</Button>
          {canDelete && (
            <Button type="button" variant="danger" className="flex-1" loading={busy === "del"} disabled={pending}
              onClick={() => { if (!confirm("حذف الجهاز نهائيًا؟")) return; setBusy("del"); start(async () => {
                const r = await deleteDevice(device.id);
                setBusy(null);
                if (!r.ok) { toast(r.error, "error"); return; }
                toast("تم حذف الجهاز"); router.push("/devices?tab=list");
              }); }}>🗑 حذف</Button>
          )}
        </div>
      )}
    </div>
  );
}
