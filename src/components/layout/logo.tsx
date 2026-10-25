import { cn } from "@/lib/utils";

// لوجو مرسال — النص العربي بالذهبي + النص الإنجليزي بالتركوازي (مطابق للهوية الرسمية)
export function Logo({
  className, showText = true, size = 40, variant = "full",
}: {
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
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark size={size} />
      {showText && (
        <div className="flex flex-col leading-none">
          {/* النص العربي - ذهبي */}
          <span className="text-2xl font-extrabold text-accent-500 tracking-tight" style={{ fontFamily: "Cairo, sans-serif" }}>
            مرسال
          </span>
          {/* النص الإنجليزي - تركوازي */}
          <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-600">
            Mersal Foundation
          </span>
        </div>
      )}
    </div>
  );
}

// أيقونة اللوجو المستقلة — دائرة بحرف "م" أو الاختصار
function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={cn("shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="mersalTeal" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id="mersalGold" x1="24" y1="10" x2="24" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f5c33b" />
          <stop offset="1" stopColor="#e0a020" />
        </linearGradient>
      </defs>
      {/* دائرة الخلفية بالتركوازي */}
      <circle cx="24" cy="24" r="22" fill="url(#mersalTeal)" />
      {/* حرف "م" بالذهبي في المنتصف */}
      <g fill="url(#mersalGold)">
        {/* شكل مبسّط لحرف الميم */}
        <path
          d="M 15 20 
             Q 15 15, 20 15 
             L 28 15 
             Q 33 15, 33 20 
             L 33 24
             Q 33 26, 31 26
             L 22 26
             Q 20 26, 20 28
             L 20 33
             Q 20 34, 19 34
             L 16 34
             Q 15 34, 15 33
             Z"
        />
        {/* نقطة الذيل */}
        <circle cx="17.5" cy="30" r="1.5" />
      </g>
    </svg>
  );
}
