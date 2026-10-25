import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { APPROVAL_CATEGORIES, APPROVAL_STATUS_LABELS } from "@/lib/approval-categories";
import { accessibleCategories, hasAnyApprovalAccess, type ApprovalPerms } from "@/lib/approval-permissions";
import { displayName, formatDateTime } from "@/lib/utils";
import type { ApprovalCategory, ApprovalStatus } from "@prisma/client";

type SP = { category?: string; status?: string; q?: string };

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
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
        <h1 className="text-xl font-bold text-slate-900">ليست لديك صلاحية لعرض الموافقات</h1>
        <p className="mt-2 text-sm text-slate-500">يرجى التواصل مع المدير</p>
      </div>
    );
  }

  const allowed = accessibleCategories(role, perms);
  const where: any = { category: { in: allowed } };
  if (sp.category && allowed.includes(sp.category as ApprovalCategory)) where.category = sp.category;
  if (sp.status) where.status = sp.status as ApprovalStatus;
  if (sp.q) {
    where.OR = [
      { approvalNumber: { contains: sp.q, mode: "insensitive" } },
      { caseCode:       { contains: sp.q, mode: "insensitive" } },
      { patientName:    { contains: sp.q, mode: "insensitive" } },
    ];
  }

  const approvals = await prisma.approval.findMany({
    where, orderBy: { createdAt: "desc" }, take: 200,
    include: {
      createdBy: { select: { fullName: true } },
      reviewer:  { select: { fullName: true } },
      team:      { select: { name: true, color: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">الموافقات الطبية</h1>
          <p className="mt-1 text-sm text-slate-500">إجمالي {approvals.length} موافقة</p>
        </div>
        <Link href="/approvals/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700">
          + موافقة جديدة
        </Link>
      </div>

      {/* فلاتر الفئات */}
      <div className="flex flex-wrap gap-2">
        <Link href="/approvals"
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            !sp.category ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}>
          الكل
        </Link>
        {allowed.map((c) => {
          const info = APPROVAL_CATEGORIES[c];
          const active = sp.category === c;
          return (
            <Link key={c} href={`/approvals?category=${c}`}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition"
              style={active
                ? { background: info.color, color: "white", borderColor: info.color }
                : { background: `${info.color}12`, color: info.color, borderColor: `${info.color}30` }}>
              <span>{info.icon}</span>{info.short}
            </Link>
          );
        })}
      </div>

      {/* فلاتر الحالة */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(APPROVAL_STATUS_LABELS).map(([key, info]) => {
          const active = sp.status === key;
          return (
            <Link key={key}
              href={`/approvals?${new URLSearchParams({ ...(sp as any), status: key }).toString()}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active ? "border-slate-800 bg-slate-800 text-white" : `border-transparent ${info.cls} hover:opacity-80`
              }`}>
              {info.label}
            </Link>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="whitespace-nowrap">الرقم</th>
                <th className="whitespace-nowrap">الفئة</th>
                <th className="whitespace-nowrap">كود الحالة</th>
                <th className="whitespace-nowrap">اسم المريض</th>
                <th className="whitespace-nowrap">التخصص</th>
                <th className="whitespace-nowrap">الحالة</th>
                <th className="whitespace-nowrap">القائم بالرفع</th>
                <th className="whitespace-nowrap">تاريخ الإضافة</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((a: any) => {
                const cat = APPROVAL_CATEGORIES[a.category as ApprovalCategory];
                const st = APPROVAL_STATUS_LABELS[a.status] ?? { label: a.status, cls: "" };
                return (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/approvals/${a.id}`} className="font-mono text-brand-700 hover:underline">
                        {a.approvalNumber}
                      </Link>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: `${cat.color}18`, color: cat.color }}>
                        <span>{cat.icon}</span>{cat.short}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-slate-700">{a.caseCode}</td>
                    <td className="text-slate-800">{a.patientName}</td>
                    <td className="text-slate-600 text-sm">{a.specialty ?? (a.extra?.disease) ?? "—"}</td>
                    <td>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="text-sm text-slate-600">{displayName(a.createdBy.fullName)}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(a.createdAt)}</td>
                  </tr>
                );
              })}
              {approvals.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-14 text-center text-slate-400">
                  <div className="text-3xl">📋</div>
                  <div className="mt-3">لا توجد موافقات بعد</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
