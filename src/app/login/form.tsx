"use client";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label, Field } from "@/components/ui/form";

export function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      <Field className="mb-0">
        <Label htmlFor="username" required>اسم المستخدم</Label>
        <Input id="username" name="username" type="text" autoComplete="username" required autoFocus dir="ltr" />
      </Field>
      <Field className="mb-0">
        <Label htmlFor="password" required>كلمة المرور</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" />
      </Field>
      {state?.error && (
        <div className="animate-fade-in-up rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
      </Button>
    </form>
  );
}
