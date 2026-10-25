import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountForms } from "./form";

export default async function AccountPage() {
  const s = await auth();
  if (!s) redirect("/login");
  const teams = await prisma.team.findMany({ where: { id: { in: s.user.teamIds } }, select: { name: true } });
  const roleAr = { manager: "مدير", supervisor: "مشرف", agent: "موظف", viewer: "مشاهد" }[s.user.role];
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">حسابي</h1>
      <div className="card grid grid-cols-2 gap-3 p-5 text-sm">
        <div><div className="text-xs text-slate-500">اسم المستخدم</div><div className="font-mono" dir="ltr" style={{ textAlign: "right" }}>@{s.user.username}</div></div>
        <div><div className="text-xs text-slate-500">الدور</div><div>{roleAr}</div></div>
        <div className="col-span-2"><div className="text-xs text-slate-500">الفرق</div><div>{teams.map((t) => t.name).join("، ") || "—"}</div></div>
      </div>
      <AccountForms name={s.user.name} />
    </div>
  );
}
