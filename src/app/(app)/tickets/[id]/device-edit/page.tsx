import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { casesEnabled } from "@/lib/cases";
import { stockByType } from "@/lib/device-stock";
import { PageHeader } from "@/components/ui/page-header";
import { DeviceRequestForm } from "@/components/devices/request-form";

export const dynamic = "force-dynamic";

export default async function EditDeviceRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await auth();
  if (!s) redirect("/login");
  const { id } = await params;
  const t = await prisma.ticket.findUnique({ where: { id }, include: { deviceRequest: true } });
  if (!t?.deviceRequest) notFound();
  if (s.user.role === "viewer" || t.status !== "pending") redirect(`/tickets/${id}`);
  const d = t.deviceRequest;
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader icon="✏️" title={`تعديل طلب الجهاز ${t.ticketNumber}`} subtitle="كل تعديل بيتسجل في سجل التذكرة بالقيمة القديمة والجديدة." />
      <DeviceRequestForm mode="edit" ticketId={id} stock={await stockByType()} casesOn={casesEnabled()} initial={{
        source: t.source, caseCode: t.caseCode ?? "", beneficiaryName: t.beneficiaryName, nationality: t.nationality,
        gender: t.gender ?? "", age: t.age?.toString() ?? "", religion: d.religion ?? "", governorate: d.governorate ?? "",
        area: d.area ?? "", city: d.city ?? "", address: d.address ?? "", phone1: t.phone1, phone2: t.phone2 ?? "",
        deviceType: d.deviceType, nursingVisit: d.nursingVisit ? "yes" : "no", nursingFrequency: d.nursingFrequency ?? "",
        socialDecision: d.socialDecision ?? "",
        socialDecisionEnd: d.socialDecisionEnd ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d.socialDecisionEnd) : "",
        hasContribution: d.hasContribution ? "yes" : "no", contributionType: d.contributionType ?? "",
        contributionAmount: d.contributionAmount?.toString() ?? "", notes: t.description ?? "",
      }} />
    </div>
  );
}
