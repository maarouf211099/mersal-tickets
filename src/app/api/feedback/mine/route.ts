import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FEEDBACK_CAMPAIGN } from "@/lib/feedback";

export const dynamic = "force-dynamic";

// هل المستخدم الحالي قيّم قبل كده (من أي جهاز)
export async function GET() {
  const s = await auth();
  if (!s || s.user.mustChangePassword) {
    return Response.json({ error: "انتهت الجلسة — سجّل الدخول تاني." }, { status: 401 });
  }
  const found = await prisma.feedback.findUnique({
    where: { campaign_userId: { campaign: FEEDBACK_CAMPAIGN, userId: s.user.id } },
    select: { id: true },
  });
  return Response.json({ submitted: !!found }, { headers: { "Cache-Control": "no-store" } });
}
