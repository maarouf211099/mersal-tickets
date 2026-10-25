import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { APPROVAL_CATEGORIES } from "@/lib/approval-categories";
import { canAccessCategory, type ApprovalPerms } from "@/lib/approval-permissions";
import { ApprovalForm } from "./form";
import type { ApprovalCategory } from "@prisma/client";

const VALID: ApprovalCategory[] = [
  "medications", "exceptions", "tests", "immunosuppressants",
  "physio", "dialysis", "operations", "supplies",
];

export default async function NewCategoryApprovalPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!VALID.includes(category as ApprovalCategory)) notFound();
  const cat = category as ApprovalCategory;

  const s = await auth();
  if (!s?.user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: s.user.id },
    select: { role: true, approvalPerms: true },
  });
  const perms = (dbUser?.approvalPerms ?? {}) as ApprovalPerms;
  if (!canAccessCategory(dbUser?.role ?? "viewer", perms, cat)) {
    redirect("/approvals/new");
  }

  const info = APPROVAL_CATEGORIES[cat];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
          style={{ background: `${info.color}15`, color: info.color }}
        >
          {info.icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">موافقة {info.label}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{info.description}</p>
        </div>
      </div>

      <ApprovalForm category={cat} accentColor={info.color} extraFields={info.extraFields ?? []} />
    </div>
  );
}
