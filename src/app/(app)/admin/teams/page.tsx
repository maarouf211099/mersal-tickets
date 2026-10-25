import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TeamsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const s = await auth();
  if (!s) redirect("/login");
  if (s.user.role !== "manager") redirect("/dashboard");
  const teams = await prisma.team.findMany({
    orderBy: [{ isReceiver: "desc" }, { name: "asc" }],
    include: { _count: { select: { members: true, tickets: { where: { access: "holder", ticket: { status: "pending" } } } } } },
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">الفرق</h1>
        <p className="mt-1 text-sm text-slate-500">
          يظهر &quot;فريق الاستقبال&quot; خيارًا للتحويل لدى الجميع، أما الفريق المقيَّد فيظهر لأعضاء الفريق المحدد فقط (مثل طبيب الخط الساخن الذي يظهر لخط طوارئ مرسال وحده).
        </p>
      </div>
      <TeamsClient teams={teams.map((t) => ({
        id: t.id, code: t.code, name: t.name, description: t.description ?? "", color: t.color,
        isActive: t.isActive, isReceiver: t.isReceiver, transferOnlyFromId: t.transferOnlyFromId,
        members: t._count.members, open: t._count.tickets,
      }))} />
    </div>
  );
}
