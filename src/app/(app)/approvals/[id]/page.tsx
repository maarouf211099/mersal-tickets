import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { APPROVAL_CATEGORIES, APPROVAL_STATUS_LABELS } from "@/lib/approval-categories";
import { canAccessCategory, canReviewApproval, type ApprovalPerms } from "@/lib/approval-permissions";
import { displayName, formatDateTime } from "@/lib/utils";
import type { ApprovalCategory } from "@prisma/client";
import { ReviewPanel } from "./review-panel";

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await auth();
  if (!s?.user) redirect("/login");

  const approval = await prisma.approval.findUnique({
    where: { id },
    include: {
      createdBy: { select: { fullName: true, username: true } },
      reviewer:  { select: { fullName: true, username: true } },
      team:      { select: { name: true, color: true } },
    },
  });
  if (!approval) notFound();

  const dbUser = await prisma.user.findUnique({
    where: { id: s.user.id },
    select: { role: true, approvalPerms: true },
  });
  const perms = (dbUser?.approvalPerms ?? {}) as ApprovalPerms;
  const role = dbUser?.role ?? "viewer";

  if (!canAccessCategory(role, perms, approval.category)) redirect("/approvals");

  const cat = APPROVAL_CATEGORIES[approval.category];
  const st = APPROVAL_STATUS_LABELS[approval.status] ?? { label: approval.status, cls: "" };
  const canReview = canReviewApproval(role);
  const extra = (approval.extra ?? {}) as Record<string, any>;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <div className="card overflow-hidden">
        <div className="h-2" style={{ background: cat.color }} />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl text-3xl"
                   style={{ background: `${cat.color}15`, color: cat.color }}>
                {cat.icon}
              </div>
              <div>
                <div className="font-mono text-sm text-slate-500" dir="ltr">{approval.approvalNumber}</div>
                <h1 className="text-2xl font-bold text-slate-900">{approval.patientName}</h1>
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                  <span>{cat.label}</span>
                  <span>•</span>
                  <span className="font-mono text-xs">كود: {approval.caseCode}</span>
                </div>
              </div>
            </div>
            <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${st.cls}`}>
              {st.label}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Content */}
        <div className="lg:col-span-2 space-y-5">
          {/* البيانات الأساسية */}
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">البيانات الأساسية</h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
              <Row label="الخدمة" value={approval.service} />
              <Row label="الشهر" value={approval.month} />
              <Row label="التخصص" value={approval.specialty} />
              <Row label="تاريخ الروشتة" value={approval.prescriptionDate ? formatDateTime(approval.prescriptionDate) : null} />
              {approval.prescriptionLink && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">رابط الروشتة / التقرير</dt>
                  <dd className="mt-1">
                    <a href={approval.prescriptionLink} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 text-brand-600 hover:underline text-sm break-all" dir="ltr">
                      🔗 فتح الملف
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* الحقول الخاصة بالفئة */}
          {Object.keys(extra).length > 0 && (
            <div className="card p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">بيانات {cat.short}</h3>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
                {(cat.extraFields ?? []).map((f) => (
                  <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                    <dt className="text-xs text-slate-500">{f.label}</dt>
                    <dd className="mt-1 text-slate-800 whitespace-pre-wrap">
                      {extra[f.key] || <span className="text-slate-400">—</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* ملاحظات القائم بالرفع */}
          {approval.uploaderNotes && (
            <div className="card p-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">ملاحظات القائم بالرفع</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{approval.uploaderNotes}</p>
            </div>
          )}

          {/* قرار الطبيب */}
          {approval.writtenApproval && (
            <div className="card p-5 border-r-4" style={{ borderRightColor: cat.color }}>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">قرار الطبيب</h3>
              {approval.approvalType && (
                <div className="mb-2 text-xs">
                  <span className="text-slate-500">نوع الموافقة:</span>{" "}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{approval.approvalType}</span>
                </div>
              )}
              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{approval.writtenApproval}</p>
              {approval.reviewer && (
                <div className="mt-3 text-xs text-slate-500">
                  بواسطة: <span className="font-medium text-slate-700">{approval.reviewer.fullName}</span>
                  {approval.reviewedAt && <> • {formatDateTime(approval.reviewedAt)}</>}
                </div>
              )}
            </div>
          )}

          {/* إجراءات الاستلام */}
          {(approval.receiptStatus || approval.receiptDate || approval.closingResponsible) && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">إجراءات الاستلام</h3>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
                <Row label="موقف الاستلام" value={approval.receiptStatus} />
                <Row label="تاريخ الاستلام" value={approval.receiptDate ? formatDateTime(approval.receiptDate) : null} />
                <Row label="مسؤول التقفيل" value={approval.closingResponsible} />
                {approval.finalNotes && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">ملاحظات نهائية</dt>
                    <dd className="mt-1 text-slate-800 whitespace-pre-wrap">{approval.finalNotes}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Meta */}
          <div className="card p-5 space-y-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">أنشأها</div>
              <div className="mt-1 font-medium text-slate-800">{approval.createdBy.fullName}</div>
              {approval.createdBy.username && (
                <div className="font-mono text-xs text-slate-500" dir="ltr">@{approval.createdBy.username}</div>
              )}
            </div>
            {approval.team && (
              <div>
                <div className="text-xs text-slate-500">الفريق</div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-700">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: approval.team.color }} />
                  {approval.team.name}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-slate-500">تاريخ الإضافة</div>
              <div className="mt-1 text-slate-700">{formatDateTime(approval.createdAt)}</div>
            </div>
          </div>

          {/* Review Panel */}
          {canReview && (
            <ReviewPanel
              approvalId={approval.id}
              currentStatus={approval.status}
              currentWritten={approval.writtenApproval ?? ""}
              currentType={approval.approvalType ?? ""}
              accentColor={cat.color}
            />
          )}
        </div>
      </div>

      <div>
        <Link href="/approvals" className="text-sm text-slate-500 hover:text-slate-800">← رجوع إلى القائمة</Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{value || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}
