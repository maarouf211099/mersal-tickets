import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRemaining(deadline: Date, now: Date = new Date()) {
  const diff = deadline.getTime() - now.getTime();
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const s = Math.floor((abs % 60_000) / 1000);
  const parts = h > 0 ? `${h}س ${m}د` : `${m}د ${s}ث`;
  return overdue ? `متأخر بـ ${parts}` : `المتبقي ${parts}`;
}

export function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  }).format(d);
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// يحوّل "أحمد عاطف محمد" إلى "أحمد.عاطف" — أول اسمين مفصولين بنقطة
export function displayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
  return fullName;
}
