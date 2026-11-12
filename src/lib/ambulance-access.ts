import type { SessionUser } from "./auth";
import { TEAM } from "./workflow";

// طلب الإسعاف من التذكرة: لفريق خط طوارئ مرسال والمدير
export function canRequestAmbulance(u: Pick<SessionUser, "role" | "teamCodes">) {
  return u.role === "manager" || (u.role !== "viewer" && u.teamCodes.includes(TEAM.EMERGENCY_HOTLINE));
}
