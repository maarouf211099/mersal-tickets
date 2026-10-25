"use client";
import { useRouter } from "next/navigation";
import { markAllRead, markNotificationRead } from "@/actions/notifications";

export function MarkAllButton() {
  const router = useRouter();
  return (
    <button onClick={async () => { await markAllRead(); router.refresh(); }}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
      تعليم الكل كمقروء
    </button>
  );
}

export function OpenLink({ id, href }: { id: string; href: string }) {
  const router = useRouter();
  return (
    <button onClick={async () => { await markNotificationRead(id); router.push(href); }}
      className="shrink-0 text-xs font-semibold text-brand-700 hover:underline">
      فتح ←
    </button>
  );
}
