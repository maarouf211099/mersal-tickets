import { cn } from "@/lib/utils";

// لوجو مرسال — النص العربي بالذهبي + النص الإنجليزي بالتركوازي (مطابق للهوية الرسمية)
export function Logo({
  className, showText = true, size = 40, variant = "full", onDark = false,
}: {
  onDark?: boolean;
  className?: string;
  showText?: boolean;
  size?: number;
  variant?: "full" | "mark" | "arabic-only";
}) {
  // "mark" - أيقونة فقط (للأماكن الضيقة)
  if (variant === "mark") {
    return <LogoMark size={size} className={className} />;
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {showText && (
        <div className="flex flex-col leading-none">
          {/* الاسم العربي — تدرّج ذهبي */}
          <span
            className={cn("bg-clip-text text-[23px] font-extrabold tracking-tight text-transparent",
              onDark ? "bg-gradient-to-l from-accent-300 to-accent-500" : "bg-gradient-to-l from-accent-500 to-accent-700")}
            style={{ fontFamily: "Cairo, sans-serif", lineHeight: 1.15 }}>
            مرسال
          </span>
          {/* سطر صغير: اسم النظام */}
          <span className={cn("mt-1 flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.22em]", onDark ? "text-brand-200" : "text-ink-700")}>
            <span className={cn("h-1 w-1 rounded-full", onDark ? "bg-accent-400" : "bg-brand-500")} />
            Mersal Tickets
          </span>
        </div>
      )}
    </div>
  );
}

// أيقونة اللوجو المستقلة — دائرة بحرف "م" أو الاختصار
function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={cn("shrink-0 drop-shadow-[0_6px_10px_rgba(7,47,45,0.28)]", className)} xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="mersalTeal" x1="6" y1="2" x2="44" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="0.55" stopColor="#0d9488" />
          <stop offset="1" stopColor="#0a3f3c" />
        </linearGradient>
        <linearGradient id="mersalGold" x1="14" y1="12" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#f0a81c" />
        </linearGradient>
        <linearGradient id="mersalShine" x1="24" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* مربع بحواف ناعمة (squircle) بدل الدايرة */}
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#mersalTeal)" />
      <path d="M16 2h16a14 14 0 0 1 14 14v4C36 26 12 26 2 20v-4A14 14 0 0 1 16 2z" fill="url(#mersalShine)" />
      <rect x="2.6" y="2.6" width="42.8" height="42.8" rx="13.4" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="1.2" />
      {/* حرف الميم الحقيقي بالذهبي */}
      <text x="24" y="28.5" textAnchor="middle" fontFamily="Cairo, 'IBM Plex Sans Arabic', sans-serif" fontWeight="800" fontSize="29" fill="url(#mersalGold)">م</text>
    </svg>
  );
}
