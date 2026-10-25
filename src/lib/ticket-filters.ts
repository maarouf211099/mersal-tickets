import "server-only";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "./auth";
import { ticketScope } from "./access";
import { normalizeDigits } from "./workflow";

export type TicketFilters = {
  status?: string; type?: string; source?: string; teamId?: string;
  q?: string; sla?: string; mine?: string; page?: string;
};

// نفس الفلاتر للقائمة وللتصدير — والـ scope دايماً بيتطبق
export function buildTicketWhere(user: SessionUser, f: TicketFilters): Prisma.TicketWhereInput {
  const and: Prisma.TicketWhereInput[] = [ticketScope(user)];
  const status = f.status ?? "pending";
  if (status === "pending" || status === "closed") and.push({ status });
  if (f.type === "new_case" || f.type === "follow_up" || f.type === "emergency") and.push({ type: f.type });
  if (f.source === "call_center" || f.source === "social_media" || f.source === "reception" || f.source === "clinics") {
    and.push({ source: f.source });
  }
  if (f.teamId) and.push({ teams: { some: { teamId: f.teamId, access: "holder" } } });
  if (f.mine === "1") and.push({ assignedToId: user.id });
  if (f.sla === "breached") and.push({ status: "pending", slaDeadline: { lt: new Date() } });
  const q = normalizeDigits(f.q?.trim() ?? "");
  if (q) {
    const c = { contains: q, mode: "insensitive" as const };
    and.push({
      OR: [
        { ticketNumber: c }, { beneficiaryName: c }, { phone1: c }, { phone2: c },
        { caseCode: c }, { nationalId: c }, { unhcrNumber: c },
      ],
    });
  }
  return { AND: and };
}
