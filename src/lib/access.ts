import "server-only";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "./auth";
import { TEAM } from "./workflow";

export const isManager = (u: Pick<SessionUser, "role">) => u.role === "manager";

// كل تيم بيشوف التيكتات بتاعته بس: اللي عنده دلوقتي أو مرّت عليه قبل كده + اللي المستخدم عملها أو مسندة له
// المدير بيشوف كل حاجة
export function ticketScope(u: SessionUser): Prisma.TicketWhereInput {
  if (isManager(u)) return {};
  return {
    OR: [
      { createdById: u.id },
      { assignedToId: u.id },
      ...(u.teamIds.length ? [
        { teams: { some: { teamId: { in: u.teamIds } } } },
        { teamVisits: { some: { teamId: { in: u.teamIds } } } },
      ] : []),
    ],
  };
}

// اللي عند فريق المستخدم دلوقتي (الافتراضي في القائمة والرئيسية علشان مفيش حاجة تتوه)
export function teamHoldScope(u: SessionUser): Prisma.TicketWhereInput {
  if (isManager(u) || !u.teamIds.length) return {};
  return { teams: { some: { teamId: { in: u.teamIds }, access: "holder" } } };
}

type TicketForAccess = {
  status: "pending" | "closed";
  createdById: string;
  assignedToId?: string | null;
  teamVisits?: { teamId: string }[];
  triageLevel: string | null;
  researchDecision: string | null;
  teams: { teamId: string; access: "holder" | "observer"; team: { code: string | null } }[];
  receivedAt?: Date | null;
};

export function ticketPermissions(u: SessionUser, t: TicketForAccess) {
  const manager = isManager(u);
  const holders = t.teams.filter((x) => x.access === "holder");
  const holderCodes = holders.map((h) => h.team.code);
  const canView = manager || t.createdById === u.id || (!!t.assignedToId && t.assignedToId === u.id)
    || t.teams.some((x) => u.teamIds.includes(x.teamId)) || (t.teamVisits ?? []).some((x) => u.teamIds.includes(x.teamId));
  const pending = t.status === "pending";
  const writer = u.role !== "viewer";
  // أي مستخدم (غير المشاهد) يقدر يتصرف في أي تيكت مفتوحة — وكل تصرف بيتسجل في السجل باسمه
  const canAct = pending && writer;
  const memberOf = (code: string) => manager || u.teamCodes.includes(code);

  return {
    canView,
    canComment: canView && writer,
    canAct, // تحويل / إسناد / تعديل بيانات / قفل / مرفقات
    canClose: canAct,
    canReopen: !pending && canView && (manager || u.canReopen),
    canTriage: canAct && holderCodes.includes(TEAM.HOTLINE_DOCTOR) && !t.triageLevel && memberOf(TEAM.HOTLINE_DOCTOR),
    canResearch: canAct && holderCodes.includes(TEAM.RESEARCH) && t.researchDecision === "pending" && memberOf(TEAM.RESEARCH),
    canDelete: manager,
    // زرار "استلام": لأعضاء الفريق اللي عنده التيكت (والمدير)، مرة واحدة بعد كل تحويل
    canReceive: pending && writer && !t.receivedAt && (manager || holders.some((h) => u.teamIds.includes(h.teamId))),
  };
}
