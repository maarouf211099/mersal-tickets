import "server-only";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "./auth";
import { TEAM } from "./workflow";

export const isManager = (u: Pick<SessionUser, "role">) => u.role === "manager";

// كل المستخدمين بيشوفوا كل التيكتات — الإجراءات بس (تحويل/إسناد/قفل) للتيم اللي ماسكها
export function ticketScope(_u: SessionUser): Prisma.TicketWhereInput {
  return {};
}

// شغل المستخدم: التيكتات اللي تيمه ماسكها أو بيتابعها + اللي هو عملها (للرئيسية وفلتر "فرقي")
export function myWorkScope(u: SessionUser): Prisma.TicketWhereInput {
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
  const holders = t.teams.filter((x) => x.access === "holder");
  const holderCodes = holders.map((h) => h.team.code);
  const canView = true;
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
  };
}
