import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountForms } from "./form";
import { PageHeader } from "@/components/ui/page-header";

export default async function AccountPage() {
  const s = await auth();
  if (!s) redirect("/login");
  const teams = await prisma.team.findMany({ where: { id: { in: s.user.teamIds } }, select: { name: true, color: true } });
  const roleAr = { manager: "مدير", supervisor: "مشرف", agent: "موظف", viewer: "مشاهد" }[s.user.role];
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader icon="⚙️" title="حسابي" subtitle="بياناتك وكلمة المرور" />
      <div className="card overflow-hidden">
        <div className="h-20 bg-gradient-to-l from-brand-700 via-brand-600 to-brand-500" />
        <div className="-mt-9 px-5 pb-5">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-white text-3xl font-bold text-brand-700 shadow-md ring-4 ring-white">
            {s.user.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="mt-3 text-xl font-bold text-slate-900">{s.user.name}</div>
          <div className="font-mono text-sm text-slate-500" dir="ltr" style={{ textAlign: "right" }}>@{s.user.username}</div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-slate-800 px-2.5 py-1 font-medium text-white">{roleAr}</span>
            {teams.map((t) => (
              <span key={t.name} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />{t.name}
              </span>
            ))}
            {teams.length === 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">لست عضوًا في أي فريق</span>}
          </div>
        </div>
      </div>
      <AccountForms name={s.user.name} />
    </div>
  );
}
