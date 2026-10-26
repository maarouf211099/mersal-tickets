import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:   "bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow disabled:hover:bg-brand-600 disabled:opacity-60",
  secondary: "bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 hover:border-slate-400",
  outline:   "bg-transparent text-brand-700 border border-brand-500 hover:bg-brand-50",
  danger:    "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow",
  ghost:     "text-slate-700 hover:bg-slate-100",
};
const sizes: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1.5 rounded-md gap-1",
  md: "text-sm px-4 py-2.5 rounded-lg gap-1.5",
  lg: "text-base px-5 py-3 rounded-lg gap-2",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(function Button({ className, variant = "primary", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.97] disabled:active:scale-100",
        "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1",
        "disabled:cursor-not-allowed",
        variants[variant], sizes[size], className,
      )}
      {...props}
    />
  );
});
