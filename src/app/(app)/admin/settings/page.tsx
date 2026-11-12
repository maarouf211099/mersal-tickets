import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await auth();
  if (!s) redirect("/login");
  if (s.user.role !== "manager") redirect("/dashboard");
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader icon="⚙️" title="إعدادات النظام" subtitle="مهلة الإنجاز، وأسباب إغلاق التذاكر، وإعلان لكل المستخدمين — التغيير يسري على التذاكر الجديدة فورًا." />
      <SettingsForm initial={await getSettings()} />
    </div>
  );
}
