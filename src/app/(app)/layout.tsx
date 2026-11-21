import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/layout/nav";
import { Toaster } from "@/components/ui/toast";
import { Suspense } from "react";
import { RouteProgress, ScrollTop } from "@/components/layout/route-progress";
import { ForcePasswordChange } from "@/components/account/force-password";
import { getSettings } from "@/lib/settings";

const ANNOUNCE_TONE = {
  info: "border-brand-200 bg-brand-50 text-brand-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-900",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { user } = session;
  if (user.mustChangePassword) return <ForcePasswordChange name={user.name} />;

  const settings = await getSettings();
  const [unread, teams] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    prisma.team.findMany({ where: { id: { in: user.teamIds } }, select: { name: true } }),
  ]);

  return (
    <div className="app-bg min-h-screen">
      <Suspense fallback={null}><RouteProgress /></Suspense>
      <Nav user={{ name: user.name, role: user.role, teams: teams.map((t) => t.name) }} initialUnread={unread} />
      <div>
        {settings.announcement.active && settings.announcement.text && (
          <div className={`animate-expand border-b px-4 py-2.5 text-center text-sm font-medium no-print ${ANNOUNCE_TONE[settings.announcement.tone]}`}>
            📢 {settings.announcement.text}
          </div>
        )}
        <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-6 sm:px-6 lg:pb-10">{children}</main>
      </div>
      <ScrollTop />
      <Toaster />
    </div>
  );
}
