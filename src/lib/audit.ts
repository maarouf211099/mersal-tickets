import "server-only";
import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "./prisma";

// تسجيل حدث في السجل العام — عمره ما بيوقّف العملية الأصلية لو فشل
export async function logSystem(actorId: string | null, action: string, metadata?: Prisma.InputJsonValue) {
  try {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await prisma.systemEvent.create({ data: { actorId, action, metadata, ip } });
  } catch (e) {
    console.error("[mersal-tickets] audit log failed:", e);
  }
}
