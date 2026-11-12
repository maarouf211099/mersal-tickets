"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ticketScope } from "@/lib/access";
import { normalizeDigits } from "@/lib/workflow";

// نتايج البحث السريع (Ctrl+K): أحدث 8 تذاكر مطابقة
export async function quickSearch(q: string) {
  const user = await requireUser();
  const term = normalizeDigits(String(q ?? "").trim()).slice(0, 80);
  if (term.length < 2) return [];
  const c = { contains: term, mode: "insensitive" as const };
  return prisma.ticket.findMany({
    where: {
      AND: [ticketScope(user), {
        OR: [{ ticketNumber: c }, { beneficiaryName: c }, { phone1: c }, { phone2: c }, { caseCode: c }, { nationalId: c }, { unhcrNumber: c }],
      }],
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, ticketNumber: true, beneficiaryName: true, type: true, status: true, phone1: true },
  });
}
