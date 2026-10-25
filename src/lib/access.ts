import "server-only";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "./auth";
import { TEAM } from "./workflow";

export const isManager = (u: Pick<SessionUser, "role">) => u.role === "manager";

// كل تيم يشوف شغله بس: التيكتات اللي تيمه ماسكها أو بيتابعها + اللي هو عملها
export function ticketScope(u: SessionUser): Prisma.TicketWhereInput {
  if (isManager(u)) return {};
  return {
    OR: [
      { createdById: u.id },
      { teams: { some: { teamId: { in: u.teamIds } } } },
    ],
  };
}

type TicketForAccess = {
  status: "pending" | "closed";
  createdById: string;
  triageLevel: string | null;
  researchDecision: string | null;
  teams: { teamId: string; access: "holder" | "observer"; team: { code: string | null } }[];
};

export function ticketPermissions(u: SessionUser, t: TicketForAccess) {
  const manager = isManager(u);
  const mine = new Set(u.teamIds);
  const holders = t.teams.filter((x) => x.access === "holder");
  const holderCodes = holders.map((h) => h.team.code);
  const myHolder = holders.some((h) => mine.has(h.teamId));
  const canView = manager || t.createdById === u.id || t.teams.some((x) => mine.has(x.teamId));
  const pending = t.status === "pending";
  const writer = u.role !== "viewer";
  const canAct = pending && writer && (manager || myHolder);
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
  };
}
