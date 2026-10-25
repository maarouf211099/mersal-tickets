import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ticketScope } from "@/lib/access";
import { INLINE_TYPES, readStoredFile } from "@/lib/storage";

export const runtime = "nodejs";

// تنزيل مرفق — بيتأكد إن المستخدم من حقه يشوف التيكت
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await auth();
  if (!s) return new Response("unauthorized", { status: 401 });
  const { id } = await params;
  const file = await prisma.attachment.findFirst({
    where: { id, ticket: ticketScope(s.user) },
  });
  if (!file) return new Response("not found", { status: 404 });

  let data: Buffer;
  try {
    data = await readStoredFile(file.storageKey);
  } catch {
    return new Response("file missing", { status: 410 });
  }
  const inline = INLINE_TYPES.has(file.mimeType);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": inline ? file.mimeType : "application/octet-stream",
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
