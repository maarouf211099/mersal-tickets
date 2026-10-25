"use client";
import { useRef, useState } from "react";

// حقل اختيار ملفات بنص عربي بدلًا من نص المتصفح الافتراضي
export function FileInput({ id, name = "files", required }: { id?: string; name?: string; required?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input ref={ref} id={id} name={name} type="file" multiple required={required} className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.txt"
        onChange={(e) => setNames(Array.from(e.target.files ?? []).map((f) => f.name))} />
      <button type="button" onClick={() => ref.current?.click()}
        className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100">
        📎 اختيار الملفات
      </button>
      <span className="text-sm text-slate-500">{names.length ? names.join("، ") : "لم يُختر أي ملف"}</span>
    </div>
  );
}
