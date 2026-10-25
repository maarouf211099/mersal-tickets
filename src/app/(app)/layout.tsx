import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/layout/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { user } = session;

  const [unread, teams] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    prisma.team.findMany({ where: { id: { in: user.teamIds } }, select: { name: true } }),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav user={{ name: user.name, role: user.role, teams: teams.map((t) => t.name) }} initialUnread={unread} />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
