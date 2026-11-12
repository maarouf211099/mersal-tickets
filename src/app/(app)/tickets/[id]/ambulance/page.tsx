import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRequestAmbulance } from "@/lib/ambulance-access";
import { ambulanceEnabled } from "@/lib/ambulance";
import { AmbulanceForm } from "./form";

export const dynamic = "force-dynamic";

export default async function AmbulanceRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await auth();
  if (!s) redirect("/login");
  const { id } = await params;
  const t = await prisma.ticket.findUnique({ where: { id } });
  if (!t) notFound();
  if (!canRequestAmbulance(s.user) || t.status !== "pending") redirect(`/tickets/${id}`);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/tickets/${id}`} className="text-sm text-brand-700 hover:underline">← {t.ticketNumber} — {t.beneficiaryName}</Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">🚑 طلب إسعاف</h1>
          <p className="mt-1 text-sm text-slate-500">الطلب يُرسل إلى نظام إسعاف مرسال ويظهر عند المنسقين في «طلبات الإسعاف»، ويُسجَّل على التذكرة.</p>
        </div>
      </div>
      {!ambulanceEnabled() && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ ربط نظام الإسعاف غير مفعّل على السيرفر بعد — يمكنك ملء البيانات، لكن الإرسال لن يتم حتى يُضبط الربط.
        </div>
      )}
      <AmbulanceForm
        ticketId={id}
        staffName={s.user.name}
        d={{
          patient: t.beneficiaryName, phone: t.phone1, phone2: t.phone2 ?? "", nationality: t.nationality,
          age: t.age?.toString() ?? "", gender: t.gender ?? "", code: t.caseCode ?? "",
          complaint: t.description ?? "", reporterRel: t.relationship === "الحالة نفسها" ? "" : t.relationship,
          fromLoc: t.location ?? "",
        }}
      />
    </div>
  );
}
