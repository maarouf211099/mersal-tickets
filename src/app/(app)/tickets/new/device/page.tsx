import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { casesEnabled } from "@/lib/cases";
import { stockByType } from "@/lib/device-stock";
import { SOURCE_BY_TEAM_CODE } from "@/lib/workflow";
import { PageHeader } from "@/components/ui/page-header";
import { DeviceRequestForm, EMPTY_REQUEST } from "@/components/devices/request-form";

export const dynamic = "force-dynamic";

export default async function NewDeviceRequestPage() {
  const s = await auth();
  if (!s) redirect("/login");
  if (s.user.role === "viewer") redirect("/tickets");
  const source = s.user.teamCodes.map((c) => SOURCE_BY_TEAM_CODE[c]).find(Boolean) ?? "";
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader icon="🩺" title="طلب جهاز طبي" subtitle="الطلب يمر على طبيب المتابعة ← الأبحاث ← قرارات مرسال، وبعدها المخزن يصرف الجهاز." />
      <DeviceRequestForm mode="create" initial={{ ...EMPTY_REQUEST, source }} stock={await stockByType()} casesOn={casesEnabled()} />
    </div>
  );
}
