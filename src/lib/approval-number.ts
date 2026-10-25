import { prisma } from "./prisma";
import type { ApprovalCategory } from "@prisma/client";

// Prefixes قصيرة لكل فئة
const PREFIX: Record<ApprovalCategory, string> = {
  medications: "MED",
  exceptions: "EXC",
  tests: "TST",
  immunosuppressants: "IMM",
  physio: "PHY",
  dialysis: "DIA",
  operations: "OPR",
  supplies: "SUP",
};

export async function nextApprovalNumber(category: ApprovalCategory): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await prisma.approvalCounter.upsert({
    where: { category },
    create: { category, year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  // إعادة العد إذا تغيرت السنة
  if (counter.year !== year) {
    await prisma.approvalCounter.update({
      where: { category },
      data: { year, lastValue: 1 },
    });
    return `${PREFIX[category]}-${year}-0001`;
  }
  return `${PREFIX[category]}-${year}-${String(counter.lastValue).padStart(4, "0")}`;
}
