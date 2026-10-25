import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { categoryList } from "@/lib/approval-categories";
import { accessibleCategories, hasAnyApprovalAccess, type ApprovalPerms } from "@/lib/approval-permissions";

export default async function NewApprovalPage() {
  const s = await auth();
  if (!s?.user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: s.user.id },
    select: { role: true, approvalPerms: true },
  });
  const perms = (dbUser?.approvalPerms ?? {}) as ApprovalPerms;
  const role = dbUser?.role ?? "viewer";

  if (!hasAnyApprovalAccess(role, perms)) {
    return (
      <div className="mx-auto max-w-2xl text-center py-20">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-slate-900">ليست لديك صلاحية لإضافة موافقات</h1>
        <p className="mt-2 text-sm text-slate-500">يرجى التواصل مع المدير لتفعيل الصلاحيات المطلوبة</p>
      </div>
    );
  }

  const allowed = new Set(accessibleCategories(role, perms));
  const cards = categoryList();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">موافقة جديدة</h1>
        <p className="mt-1 text-sm text-slate-500">اختر نوع الموافقة للبدء</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const has = allowed.has(c.key);
          return (
            <CategoryCard key={c.key} category={c} enabled={has} />
          );
        })}
      </div>

      {allowed.size < cards.length && (
        <p className="mt-6 text-center text-xs text-slate-400">
          🔒 الفئات الرمادية تحتاج تفعيل صلاحية من المدير
        </p>
      )}
    </div>
  );
}

function CategoryCard({ category, enabled }: {
  category: ReturnType<typeof categoryList>[number];
  enabled: boolean;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-3">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl transition-all duration-300"
          style={enabled ? { background: `${category.color}15`, color: category.color } : { background: "#f1f5f9", color: "#94a3b8" }}
        >
          {category.icon}
        </div>
        {!enabled && <span className="text-xs text-slate-400">🔒</span>}
      </div>
      <div className="text-lg font-bold text-slate-900 group-hover:text-slate-950">
        {category.label}
      </div>
      <div className="mt-1 text-xs text-slate-500 leading-relaxed">
        {category.description}
      </div>
      {enabled && (
        <div
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: category.color }}
        >
          إضافة ←
        </div>
      )}
    </>
  );

  if (!enabled) {
    return (
      <div className="group cursor-not-allowed rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5 text-right opacity-70">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/approvals/new/${category.key}`}
      className="group block rounded-2xl border-2 bg-white p-5 text-right transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
      style={{ borderColor: `${category.color}40` }}
    >
      {content}
    </Link>
  );
}
