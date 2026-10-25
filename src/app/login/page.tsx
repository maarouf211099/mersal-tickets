import { Suspense } from "react";
import { Logo } from "@/components/layout/logo";
import { LoginForm } from "./form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-accent-50/30 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <Logo size={72} showText={false} />
          </div>
          <h1 className="text-3xl font-extrabold text-accent-500" style={{ fontFamily: "Cairo, sans-serif" }}>مرسال</h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.3em] text-brand-600">Mersal Foundation</p>
          <p className="mt-3 text-sm text-slate-500">نظام التذاكر</p>
        </div>
        <div className="animate-fade-in-up rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-brand-900/5">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">تسجيل الدخول</h2>
          <p className="mb-6 text-sm text-slate-500">أدخل بياناتك للمتابعة</p>
          <Suspense fallback={<div className="py-8 text-center text-sm text-slate-400">جاري التحميل...</div>}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} مؤسسة مرسال — جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
