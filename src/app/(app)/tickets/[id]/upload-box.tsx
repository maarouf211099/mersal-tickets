"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadAttachments } from "@/actions/tickets";
import { Button } from "@/components/ui/button";

export function UploadBox({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <form ref={formRef} className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setErr(null);
        start(async () => {
          const r = await uploadAttachments(ticketId, form);
          if (!r.ok) setErr(r.error);
          else { formRef.current?.reset(); router.refresh(); }
        });
      }}>
      <input name="files" type="file" multiple required
        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.txt"
        className="text-sm text-slate-600 file:ml-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700" />
      <Button size="sm" variant="secondary" disabled={pending}>{pending ? "جاري الرفع..." : "رفع"}</Button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </form>
  );
}
