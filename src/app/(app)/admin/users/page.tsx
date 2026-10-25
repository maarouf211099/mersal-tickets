import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersClient } from "./client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const s = await auth();
  if (!s) redirect("/login");
  if (s.user.role !== "manager") redirect("/dashboard");
  const [users, teams] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
      include: { teams: { select: { teamId: true } } },
    }),
    prisma.team.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
  ]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">المستخدمون</h1>
        <p className="mt-1 text-sm text-slate-500">كل مستخدم يشوف شغل التيمات اللي هو عضو فيها بس. المدير يشوف الكل.</p>
      </div>
      <UsersClient
        meId={s.user.id}
        teams={teams}
        users={users.map((u) => ({
          id: u.id, username: u.username, fullName: u.fullName, role: u.role, isActive: u.isActive,
          canReopen: u.canReopen, canExport: u.canExport, teamIds: u.teams.map((t) => t.teamId),
          approvalPerms: (u.approvalPerms ?? {}) as Record<string, boolean>,
        }))}
      />
    </div>
  );
}
