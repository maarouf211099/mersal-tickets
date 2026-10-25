import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session";
import type { UserRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  canReopen: boolean;
  canExport: boolean;
  teamIds: string[];
  teamCodes: string[];
};

// المستخدم بيتقري من الداتابيز في كل request — لو اتوقف أو اتغيرت صلاحياته بيسري فوراً
export const auth = cache(async (): Promise<{ user: SessionUser } | null> => {
  const jar = await cookies();
  const userId = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: { teams: { include: { team: { select: { id: true, code: true, isActive: true } } } } },
  });
  if (!u || !u.isActive) return null;
  const teams = u.teams.map((m) => m.team).filter((t) => t.isActive);
  return {
    user: {
      id: u.id, username: u.username, name: u.fullName, role: u.role,
      canReopen: u.canReopen, canExport: u.canExport,
      teamIds: teams.map((t) => t.id),
      teamCodes: teams.map((t) => t.code).filter((c): c is string => !!c),
    },
  };
});

export async function requireUser(): Promise<SessionUser> {
  const s = await auth();
  if (!s) throw new Error("غير مسجَّل الدخول");
  return s.user;
}

export async function startSession(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
