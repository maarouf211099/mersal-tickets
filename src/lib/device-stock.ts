import "server-only";
import { prisma } from "./prisma";

// عدد الأجهزة المتاحة في المخزن لكل نوع
export async function stockByType(): Promise<Record<string, number>> {
  const rows = await prisma.device.groupBy({ by: ["type"], where: { status: "in_stock" }, _count: true });
  return Object.fromEntries(rows.map((r) => [r.type, r._count]));
}
