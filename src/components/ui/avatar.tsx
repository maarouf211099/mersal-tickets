// دايرة بأول حرف من الاسم — كل شخص ليه لون ثابت محسوب من اسمه
const PALETTE = [
  "bg-brand-100 text-brand-800", "bg-violet-100 text-violet-800", "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-800", "bg-emerald-100 text-emerald-800",
  "bg-indigo-100 text-indigo-800", "bg-orange-100 text-orange-800",
];

export function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function Avatar({ name, size = "sm", className = "" }: { name: string; size?: "xs" | "sm" | "md"; className?: string }) {
  const dim = size === "xs" ? "h-6 w-6 text-[11px]" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white ${dim} ${avatarColor(name)} ${className}`} aria-hidden>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
