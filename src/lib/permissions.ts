import type { UserRole } from "@prisma/client";

export const isAdmin = (r: UserRole) => r === "manager";
export const isStaff = (r: UserRole) => r === "supervisor" || r === "manager";
