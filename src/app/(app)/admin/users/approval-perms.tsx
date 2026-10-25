"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { APPROVAL_CATEGORIES } from "@/lib/approval-categories";
import { updateApprovalPerms } from "@/actions/approvals";

export function ApprovalPermsPanel({
  userId, currentPerms,
}: {
  userId: string;
  currentPerms: Record<string, boolean>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [perms, setPerms] = useState(currentPerms);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(cat: string) {
    const next = { ...perms, [cat]: !perms[cat] };
    setPerms(next);
    start(async () => {
      await updateApprovalPerms(userId, next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      router.refresh();
    });
  }

  const activeCount = Object.values(perms).filter(Boolean).length;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
      >
        🔐 صلاحيات ({activeCount}/8) {open ? "▲" : "▼"}
      </button>
      {saved && <span className="mr-2 text-xs text-emerald-600">✓</span>}
      {open && (
        <div className="mt-2 grid grid-cols-1 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
          {Object.values(APPROVAL_CATEGORIES).map((c) => {
            const on = !!perms[c.key];
            return (
              <button
                key={c.key}
                onClick={() => toggle(c.key)}
                disabled={pending}
                className={`flex items-center justify-between rounded-md px-2 py-1.5 text-right text-xs transition ${
                  on ? "bg-white text-slate-800 shadow-sm" : "bg-transparent text-slate-500 hover:bg-white"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>{c.icon}</span>{c.short}
                </span>
                <span className={`inline-flex h-4 w-8 items-center rounded-full transition ${on ? "bg-brand-600" : "bg-slate-300"}`}>
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition ${on ? "-translate-x-1" : "-translate-x-4"}`} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
