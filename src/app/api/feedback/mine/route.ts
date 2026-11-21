export const dynamic = "force-dynamic";

// التقييم اتشال — التبويبات القديمة اللي لسه فيها الكود القديم بتسأل هنا كل شوية؛
// لو مالقتش رد بتعرض الرسالة، فـ"submitted" بيخليها تبطّل وتحفظ ده عند المستخدم.
// الحملة كانت لحد 2026-11-30، وبعدها ينفع يتشال الملف ده.
export async function GET() {
  return Response.json(
    { ok: true, submitted: true, canViewResults: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
