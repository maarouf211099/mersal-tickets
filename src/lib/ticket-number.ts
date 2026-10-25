import { prisma } from "./prisma";
import { TYPE_PREFIX, type TicketType } from "./workflow";

// NC-2026-0001 / FU-2026-0001 / EM-2026-0001
export async function nextTicketNumber(type: TicketType): Promise<string> {
  const counterId = `${TYPE_PREFIX[type]}-${new Date().getFullYear()}`;
  const counter = await prisma.ticketCounter.upsert({
    where: { id: counterId },
    update: { value: { increment: 1 } },
    create: { id: counterId, value: 1 },
  });
  return `${counterId}-${String(counter.value).padStart(4, "0")}`;
}
