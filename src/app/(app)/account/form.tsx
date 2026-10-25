"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeMyPassword, updateMyName } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/form";

export function AccountForms({ name }: { name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fullName, setFullName] = useState(name);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <>
      <div className="card p-5">
        <Field>
          <Label htmlFor="fullName">الاسم</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Button disabled={pending} onClick={() => start(async () => {
          const r = await updateMyName(fullName);
          setMsg(r.ok ? { ok: true, text: "اتحفظ" } : { ok: false, text: r.error });
          router.refresh();
        })}>حفظ الاسم</Button>
      </div>
      <div className="card p-5">
        <Field>
          <Label htmlFor="cur">كلمة المرور الحالية</Label>
          <Input id="cur" type="password" dir="ltr" value={cur} onChange={(e) => setCur(e.target.value)} />
        </Field>
        <Field>
          <Label htmlFor="new">كلمة المرور الجديدة (8 حروف على الأقل)</Label>
          <Input id="new" type="password" dir="ltr" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Button disabled={pending || !cur || !next} onClick={() => start(async () => {
          const r = await changeMyPassword({ currentPassword: cur, newPassword: next });
          setMsg(r.ok ? { ok: true, text: "اتغيرت كلمة المرور" } : { ok: false, text: r.error });
          if (r.ok) { setCur(""); setNext(""); }
        })}>تغيير كلمة المرور</Button>
      </div>
      {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}
    </>
  );
}
