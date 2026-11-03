"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth, requireUser } from "@/lib/auth";
import { logSystem } from "@/lib/audit";

const schema = z.object({
  currentPassword: z.string().min(1, "يُرجى إدخال كلمة المرور الحالية"),
  newPassword: z.string().min(8, "يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف"),
});

// بتستخدم auth() مش requireUser() علشان تشتغل كمان لو المستخدم لسه لازم يغيّر كلمة المرور المؤقتة
export async function changeMyPassword(input: unknown) {
  const s = await auth();
  if (!s) return { ok: false as const, error: "غير مسجَّل الدخول" };
  const me = s.user;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "خطأ" };
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return { ok: false as const, error: "كلمة المرور الحالية غير صحيحة" };
  }
  if (parsed.data.newPassword === parsed.data.currentPassword) {
    return { ok: false as const, error: "يجب أن تختلف كلمة المرور الجديدة عن الحالية" };
  }
  await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10), mustChangePassword: false },
  });
  await logSystem(me.id, "password_changed");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function updateMyName(fullName: string) {
  const me = await requireUser();
  const name = fullName.trim();
  if (name.length < 2) return { ok: false as const, error: "الاسم قصير" };
  await prisma.user.update({ where: { id: me.id }, data: { fullName: name } });
  if (name !== me.name) await logSystem(me.id, "name_changed", { from: me.name, to: name });
  revalidatePath("/account");
  return { ok: true as const };
}
