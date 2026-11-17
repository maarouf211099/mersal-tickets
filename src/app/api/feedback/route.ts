import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FEEDBACK_CAMPAIGN, canViewFeedbackResults, parseFeedback } from "@/lib/feedback";

export const dynamic = "force-dynamic";

const unauthorized = () => Response.json({ error: "انتهت الجلسة — سجّل الدخول تاني." }, { status: 401 });

// تسجيل تقييم المستخدم (رد واحد لكل مستخدم في الحملة — لو بعت تاني بيتحدّث)
export async function POST(req: Request) {
  const s = await auth();
  if (!s || s.user.mustChangePassword) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "بيانات التقييم غير صحيحة." }, { status: 400 });
  }
  const parsed = parseFeedback(body);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  try {
    await prisma.feedback.upsert({
      where: { campaign_userId: { campaign: FEEDBACK_CAMPAIGN, userId: s.user.id } },
      create: { campaign: FEEDBACK_CAMPAIGN, userId: s.user.id, ...parsed.data },
      update: parsed.data,
    });
  } catch (e) {
    console.error("[mersal-tickets] feedback save failed:", e);
    return Response.json({ error: "تعذّر حفظ التقييم — حاول تاني بعد شوية." }, { status: 500 });
  }
  return Response.json({ ok: true });
}

// كل الردود — للمديرين (manager) + FEEDBACK_RESULTS_USER
export async function GET() {
  const s = await auth();
  if (!s || s.user.mustChangePassword) return unauthorized();
  if (!canViewFeedbackResults(s.user)) {
    return Response.json({ error: "غير مسموح لك بعرض نتائج التقييم." }, { status: 403 });
  }

  const rows = await prisma.feedback.findMany({
    where: { campaign: FEEDBACK_CAMPAIGN },
    orderBy: { createdAt: "desc" },
    // من غير userId ولا username — الاسم بس اللي المستخدم كتبه بنفسه
    select: {
      createdAt: true, department: true, name: true, overall: true, ease: true, speed: true, value: true,
      problems: true, ideas: true,
    },
  });
  return Response.json(
    rows.map((r) => ({ ...r, name: r.name ?? "", problems: r.problems ?? "", ideas: r.ideas ?? "" })),
    { headers: { "Cache-Control": "no-store" } },
  );
}
