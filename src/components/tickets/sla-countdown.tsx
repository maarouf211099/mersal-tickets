"use client";
import { useEffect, useState } from "react";
import { cn, formatRemaining } from "@/lib/utils";

export function SlaCountdown({ deadline }: { deadline: string }) {
  const target = new Date(deadline);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="font-mono text-xs text-slate-400">…</span>;
  const remaining = target.getTime() - now.getTime();
  const overdue = remaining < 0;
  const warn = !overdue && remaining < 30 * 60 * 1000;
  return (
    <span className={cn("font-mono text-xs", overdue ? "font-semibold text-red-600" : warn ? "text-amber-600" : "text-slate-600")}>
      {formatRemaining(target, now)}
    </span>
  );
}
