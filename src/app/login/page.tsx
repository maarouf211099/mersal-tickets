import { Suspense } from "react";
import { Logo } from "@/components/layout/logo";
import { ClockIcon, ShareIcon, ShieldIcon } from "@/components/ui/icons";
import { LoginForm } from "./form";

const FEATURES = [
  { icon: ClockIcon, title: "متابعة مهلة الإنجاز", text: "تنبيه فوري قبل تأخر أي حالة، وأولوية واضحة للطوارئ" },
  { icon: ShareIcon, title: "تحويل بين الفرق", text: "كل حالة تنتقل بسجلها الكامل من فريق إلى آخر" },
  { icon: ShieldIcon, title: "بيانات محمية", text: "كل فريق يرى تذاكره فقط حسب صلاحياته" },
];

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="relative hidden w-[46%] overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-accent-400/15" />
        <div className="relative flex items-center gap-3">
          <Logo size={52} showText={false} />
          <div>
            <div className="text-2xl font-extrabold text-accent-400">مرسال</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-100">Mersal Foundation</div>
          </div>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight">نظام التذاكر</h1>
          <p className="mt-3 max-w-md text-brand-100">كل حالة تصل إلى الفريق المختص في الوقت المناسب، ومعها سجلها الكامل.</p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                  <f.icon className="h-5 w-5 text-accent-300" />
                </span>
                <div>
                  <div className="font-semibold">{f.title}</div>
                  <div className="text-sm text-brand-100">{f.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-200">© {new Date().getFullYear()} مؤسسة مرسال — جميع الحقوق محفوظة</p>
      </aside>

      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-brand-50 via-white to-accent-50/30 p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <div className="mb-4 flex justify-center">
              <Logo size={72} showText={false} />
            </div>
            <h1 className="text-3xl font-extrabold text-accent-500">مرسال</h1>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.3em] text-brand-600">Mersal Foundation</p>
            <p className="mt-3 text-sm text-slate-500">نظام التذاكر</p>
          </div>
          <div className="animate-fade-in-up rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-brand-900/5">
            <h2 className="mb-1 text-2xl font-bold text-slate-900">تسجيل الدخول</h2>
            <p className="mb-6 text-sm text-slate-500">مرحبًا بعودتك، أدخل بياناتك للمتابعة</p>
            <Suspense fallback={<div className="py-8 text-center text-sm text-slate-400">جاري التحميل...</div>}>
              <LoginForm />
            </Suspense>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400 lg:hidden">
            © {new Date().getFullYear()} مؤسسة مرسال — جميع الحقوق محفوظة
          </p>
        </div>
      </div>
    </div>
  );
}
