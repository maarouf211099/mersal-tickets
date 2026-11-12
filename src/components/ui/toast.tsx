"use client";
import { useEffect, useState } from "react";

// رسايل تأكيد صغيرة بتظهر فوق وتختفي لوحدها — toast("تم التحويل") من أي client component
type Kind = "success" | "error" | "info";
type Item = { id: number; text: string; kind: Kind; leaving?: boolean };

const listeners = new Set<(t: Item) => void>();
let seq = 0;

export function toast(text: string, kind: Kind = "success") {
  const item = { id: ++seq, text, kind };
  listeners.forEach((l) => l(item));
}

const DURATION = 3500;
const STYLE: Record<Kind, { icon: string; ring: string; bar: string }> = {
  success: { icon: "✓", ring: "bg-emerald-500", bar: "bg-emerald-500" },
  error: { icon: "!", ring: "bg-red-500", bar: "bg-red-500" },
  info: { icon: "i", ring: "bg-brand-500", bar: "bg-brand-500" },
};

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const add = (t: Item) => {
      setItems((xs) => [...xs.slice(-3), t]);
      setTimeout(() => setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, leaving: true } : x))), DURATION);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), DURATION + 300);
    };
    listeners.add(add);
    return () => { listeners.delete(add); };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 lg:bottom-4 z-[60] flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2 no-print" aria-live="polite">
      {items.map((t) => (
        <div key={t.id}
          className={`pointer-events-auto relative overflow-hidden rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl shadow-slate-900/10 backdrop-blur ${t.leaving ? "animate-toast-out" : "animate-toast-in"}`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${STYLE[t.kind].ring}`}>{STYLE[t.kind].icon}</span>
            <span className="text-sm font-medium text-slate-800">{t.text}</span>
          </div>
          <span className={`absolute bottom-0 right-0 h-0.5 animate-toast-bar ${STYLE[t.kind].bar}`} style={{ animationDuration: `${DURATION}ms` }} />
        </div>
      ))}
    </div>
  );
}
