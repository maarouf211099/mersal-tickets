"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type Result = { ok: true } | { ok: false; error: string };

async function requireManager() {
  const u = await requireUser();
  if (u.role !== "manager") throw new Error("غير مصرح");
  return u;
}

function done(): Result {
  revalidatePath("/admin/users");
  revalidatePath("/admin/teams");
  return { ok: true };
}

const fail = (e: unknown): Result => ({ ok: false, error: e instanceof Error ? e.message : "خطأ" });

// ─── المستخدمين ───────────────────────────────────────────
const roles = z.enum(["manager", "supervisor", "agent", "viewer"]);

const userSchema = z.object({
  username: z.string().trim().toLowerCase().min(2, "اسم المستخدم قصير")
    .regex(/^[a-z0-9._-]+$/, "يقتصر اسم المستخدم على الحروف الإنجليزية والأرقام والرموز . _ -"),
  fullName: z.string().trim().min(2, "الاسم قصير"),
  password: z.string().min(8, "يجب ألا تقل كلمة المرور عن 8 أحرف"),
  role: roles,
  teamIds: z.array(z.string()).default([]),
  canReopen: z.boolean().default(false),
  canExport: z.boolean().default(false),
});

export async function createUser(input: unknown): Promise<Result> {
  try {
    await requireManager();
    const parsed = userSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "خطأ" };
    const d = parsed.data;
    if (await prisma.user.findUnique({ where: { username: d.username } })) {
      return { ok: false, error: "اسم المستخدم موجود بالفعل" };
    }
    await prisma.user.create({
      data: {
        username: d.username, fullName: d.fullName, role: d.role,
        passwordHash: await bcrypt.hash(d.password, 10),
        canReopen: d.canReopen, canExport: d.canExport,
        teams: { create: d.teamIds.map((teamId) => ({ teamId })) },
      },
    });
    return done();
  } catch (e) { return fail(e); }
}

const updateSchema = z.object({
  fullName: z.string().trim().min(2, "الاسم قصير"),
  role: roles,
  teamIds: z.array(z.string()),
  canReopen: z.boolean(),
  canExport: z.boolean(),
  isActive: z.boolean(),
});

export async function updateUser(userId: string, input: unknown): Promise<Result> {
  try {
    const me = await requireManager();
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "خطأ" };
    const d = parsed.data;
    if (userId === me.id && (d.role !== "manager" || !d.isActive)) {
      return { ok: false, error: "لا يمكنك إزالة صلاحية المدير عن حسابك أو إيقافه" };
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { fullName: d.fullName, role: d.role, canReopen: d.canReopen, canExport: d.canExport, isActive: d.isActive },
      }),
      prisma.teamMember.deleteMany({ where: { userId } }),
      prisma.teamMember.createMany({ data: d.teamIds.map((teamId) => ({ userId, teamId })) }),
    ]);
    return done();
  } catch (e) { return fail(e); }
}

export async function resetPassword(userId: string, password: string): Promise<Result> {
  try {
    await requireManager();
    if (password.length < 8) return { ok: false, error: "يجب ألا تقل كلمة المرور عن 8 أحرف" };
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    return done();
  } catch (e) { return fail(e); }
}

// ─── التيمات ──────────────────────────────────────────────
const teamSchema = z.object({
  name: z.string().trim().min(2, "اسم الفريق قصير"),
  description: z.string().trim().max(300).default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "لون غير صحيح"),
  isReceiver: z.boolean(),
  isActive: z.boolean(),
  transferOnlyFromId: z.string().nullable(),
});

export async function saveTeam(teamId: string | null, input: unknown): Promise<Result> {
  try {
    await requireManager();
    const parsed = teamSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "خطأ" };
    const d = { ...parsed.data, description: parsed.data.description || null };
    if (teamId && d.transferOnlyFromId === teamId) return { ok: false, error: "لا يمكن تقييد الفريق على نفسه" };
    const clash = await prisma.team.findFirst({ where: { name: d.name, NOT: teamId ? { id: teamId } : undefined } });
    if (clash) return { ok: false, error: "يوجد فريق بالاسم نفسه" };
    if (teamId) await prisma.team.update({ where: { id: teamId }, data: d });
    else await prisma.team.create({ data: d });
    revalidatePath("/tickets");
    return done();
  } catch (e) { return fail(e); }
}
