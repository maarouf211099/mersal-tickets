import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/access";
import { SOURCE_BY_TEAM_CODE, transferTargets } from "@/lib/workflow";
import { NewTicketForm } from "./form";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewTicketPage() {
  const s = await auth();
  if (!s) redirect("/login");
  const { user } = s;
  if (user.role === "viewer") redirect("/tickets");

  const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });
  const targets = transferTargets(teams, user.teamIds, isManager(user));
  const defaultSource = user.teamCodes.map((c) => SOURCE_BY_TEAM_CODE[c]).find(Boolean) ?? "";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader icon="➕" title="تذكرة جديدة" subtitle="أدخل بيانات الحالة واختر الفريق الذي ستُحوَّل إليه" />
      <NewTicketForm
        targets={targets.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
        defaultSource={defaultSource}
      />
    </div>
  );
}
