import * as React from "react";
import { cn } from "@/lib/utils";

// نظام موحد للحقول: كلها بنفس الارتفاع، نفس الـ padding، نفس الـ typography
const baseField =
  "block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 " +
  "placeholder:text-slate-400 " +
  "transition-colors " +
  "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 " +
  "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    return <input ref={ref} {...props} className={cn(baseField, props.className)} />;
  }
);

export function Textarea(props: React.ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(baseField, "min-h-[100px] resize-y leading-relaxed", props.className)} />;
}

export function Select(props: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(baseField, "bg-white pr-8 appearance-none bg-no-repeat bg-[position:left_0.75rem_center] bg-[length:1em]", props.className)}
      style={{
        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`,
        ...(props.style || {}),
      }}
    />
  );
}

export function Label({ children, htmlFor, required }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

export function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}
