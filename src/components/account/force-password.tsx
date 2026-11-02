"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeMyPassword } from "@/actions/account";
import { logout } from "@/actions/auth";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/form";

// بتظهر بدل النظام كله لحد ما المستخدم يغيّر كلمة المرور المؤقتة اللي حددها المدير
export function ForcePasswordChange({ name }: { name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (next !== confirm) { setErr("كلمتا المرور الجديدتان غير متطابقتين"); return; }
    start(async () => {
      const r = await changeMyPassword({ currentPassword: cur, newPassword: next });
      if (!r.ok) { setErr(r.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-accent-50/30 p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="mb-6 flex justify-center"><Logo size={56} showText={false} /></div>
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-brand-900/5">
          <h1 className="text-xl font-bold text-slate-900">مرحبًا، {name} 👋</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">
            هذه أول مرة تدخل فيها إلى النظام، أو أعاد المدير تعيين كلمة مرورك. يُرجى اختيار كلمة مرور جديدة خاصة بك للمتابعة.
          </p>
          <Field>
            <Label htmlFor="cur" required>كلمة المرور الحالية (المؤقتة)</Label>
            <Input id="cur" type="password" dir="ltr" autoComplete="current-password" required autoFocus value={cur} onChange={(e) => setCur(e.target.value)} />
          </Field>
          <Field>
            <Label htmlFor="new" required>كلمة المرور الجديدة (8 أحرف على الأقل)</Label>
            <Input id="new" type="password" dir="ltr" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field>
            <Label htmlFor="confirm" required>تأكيد كلمة المرور الجديدة</Label>
            <Input id="confirm" type="password" dir="ltr" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {err && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{err}</div>}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "جاري الحفظ..." : "حفظ والمتابعة"}
          </Button>
          <button type="button" onClick={() => logout()} className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700">
            تسجيل الخروج
          </button>
        </form>
      </div>
    </div>
  );
}
