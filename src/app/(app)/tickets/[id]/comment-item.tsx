"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteComment, editComment } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";

// نص التحديث + (لصاحبه بس) تعديل وحذف
export function CommentBody({ id, body, mine, children }: {
  id: string; body: string; mine: boolean; children: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(body);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <div className="animate-expand">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[80px] bg-white" autoFocus />
        <div className="mt-2 flex gap-2">
          <Button size="sm" loading={pending} disabled={!text.trim() || text.trim() === body}
            onClick={() => start(async () => {
              const r = await editComment(id, text);
              if (!r.ok) { toast(r.error, "error"); return; }
              toast("تم حفظ التعديل");
              setEditing(false);
              router.refresh();
            })}>حفظ التعديل</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setText(body); setEditing(false); }}>إلغاء</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/c">
      {children}
      {mine && (
        <div className="no-print mt-2 flex gap-1 opacity-60 transition-opacity group-hover/c:opacity-100">
          <button type="button" onClick={() => setEditing(true)}
            className="rounded-md px-2 py-0.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-brand-700">✏️ تعديل</button>
          <button type="button" disabled={pending}
            onClick={() => {
              if (!confirm("هل تريد حذف هذا التحديث؟")) return;
              start(async () => {
                const r = await deleteComment(id);
                if (!r.ok) { toast(r.error, "error"); return; }
                toast("تم حذف التحديث");
                router.refresh();
              });
            }}
            className="rounded-md px-2 py-0.5 text-xs text-slate-500 transition hover:bg-red-50 hover:text-red-600">🗑️ حذف</button>
        </div>
      )}
    </div>
  );
}
