"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function markNotificationRead(id: string) {
  const me = await requireUser();
  await prisma.notification.updateMany({ where: { id, userId: me.id }, data: { isRead: true } });
  revalidatePath("/notifications");
}

export async function markAllRead() {
  const me = await requireUser();
  await prisma.notification.updateMany({ where: { userId: me.id, isRead: false }, data: { isRead: true } });
  revalidatePath("/notifications");
}
