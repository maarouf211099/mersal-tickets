export const dynamic = "force-dynamic";

// التقييم اتشال — رد ثابت عشان رسالة التقييم القديمة (لو مفتوحة في تبويب قديم) ماتطلّعش خطأ.
// الحملة كانت لحد 2026-11-30، وبعدها ينفع يتشال الملف ده.
export async function POST() {
  return Response.json({ ok: true });
}
