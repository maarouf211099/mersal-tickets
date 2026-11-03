"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logSystem } from "@/lib/audit";

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
const ROLE_AR: Record<string, string> = { manager: "مدير", supervisor: "مشرف", agent: "موظف", viewer: "مشاهد" };

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
    const me = await requireManager();
    const parsed = userSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "خطأ" };
    const d = parsed.data;
    if (await prisma.user.findUnique({ where: { username: d.username } })) {
      return { ok: false, error: "اسم المستخدم موجود بالفعل" };
    }
    await prisma.user.create({
      data: {
        username: d.username, fullName: d.fullName, role: d.role,
        passwordHash: await bcrypt.hash(d.password, 10), mustChangePassword: true,
        canReopen: d.canReopen, canExport: d.canExport,
        teams: { create: d.teamIds.map((teamId) => ({ teamId })) },
      },
    });
    await logSystem(me.id, "user_created", { name: d.fullName, username: d.username, role: d.role });
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
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: userId }, include: { teams: { include: { team: { select: { id: true, name: true } } } } },
    });
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { fullName: d.fullName, role: d.role, canReopen: d.canReopen, canExport: d.canExport, isActive: d.isActive },
      }),
      prisma.teamMember.deleteMany({ where: { userId } }),
      prisma.teamMember.createMany({ data: d.teamIds.map((teamId) => ({ userId, teamId })) }),
    ]);
    const teamNames = async (ids: string[]) =>
      (await prisma.team.findMany({ where: { id: { in: ids } }, select: { name: true }, orderBy: { name: "asc" } })).map((t) => t.name).join(" + ") || "—";
    const yes = (b: boolean) => (b ? "نعم" : "لا");
    const changes: { label: string; from: string; to: string }[] = [];
    if (before.fullName !== d.fullName) changes.push({ label: "الاسم", from: before.fullName, to: d.fullName });
    if (before.role !== d.role) changes.push({ label: "الدور", from: ROLE_AR[before.role], to: ROLE_AR[d.role] });
    const beforeTeams = before.teams.map((t) => t.team.id).sort().join();
    if (beforeTeams !== [...d.teamIds].sort().join()) {
      changes.push({ label: "الفرق", from: await teamNames(before.teams.map((t) => t.team.id)), to: await teamNames(d.teamIds) });
    }
    if (before.canReopen !== d.canReopen) changes.push({ label: "إعادة الفتح", from: yes(before.canReopen), to: yes(d.canReopen) });
    if (before.canExport !== d.canExport) changes.push({ label: "التصدير", from: yes(before.canExport), to: yes(d.canExport) });
    if (before.isActive !== d.isActive) changes.push({ label: "نشط", from: yes(before.isActive), to: yes(d.isActive) });
    if (changes.length) await logSystem(me.id, "user_updated", { name: d.fullName, username: before.username, changes });
    return done();
  } catch (e) { return fail(e); }
}

export async function resetPassword(userId: string, password: string): Promise<Result> {
  try {
    const me = await requireManager();
    if (password.length < 8) return { ok: false, error: "يجب ألا تقل كلمة المرور عن 8 أحرف" };
    const u = await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true } });
    await logSystem(me.id, "password_reset", { name: u.fullName, username: u.username });
    return done();
  } catch (e) { return fail(e); }
}

// ─── إضافة مجموعة مستخدمين ────────────────────────────────
// كل سطر: الاسم، اسم المستخدم (أو الإيميل)، الفريق — مفصولين بفاصلة أو Tab
export type ImportResult =
  | { ok: true; created: number; skipped: { line: number; text: string; reason: string }[] }
  | { ok: false; error: string };

export async function importUsers(input: { lines: string; password: string; role: string }): Promise<ImportResult> {
  try {
    const me = await requireManager();
    if (input.password.length < 8) return { ok: false, error: "يجب ألا تقل كلمة المرور المؤقتة عن 8 أحرف" };
    const role = roles.safeParse(input.role);
    if (!role.success) return { ok: false, error: "دور غير صحيح" };

    const teams = await prisma.team.findMany({ select: { id: true, name: true, code: true } });
    const norm = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();
    const teamByKey = new Map<string, string>();
    for (const t of teams) {
      teamByKey.set(norm(t.name), t.id);
      if (t.code) teamByKey.set(norm(t.code), t.id);
    }

    const skipped: { line: number; text: string; reason: string }[] = [];
    const rows: { username: string; fullName: string; teamIds: string[] }[] = [];
    const seen = new Set<string>();
    input.lines.split(/\r?\n/).forEach((raw, i) => {
      const text = raw.replace(/\u00a0/g, " ").trim();
      if (!text) return;
      const [name = "", login = "", teamCell = ""] = text.split(/\t|,|،/).map((c) => c.trim());
      const username = login.split("@")[0].toLowerCase();
      const skip = (reason: string) => skipped.push({ line: i + 1, text, reason });
      if (name.length < 2) return skip("الاسم ناقص");
      if (!/^[a-z0-9._-]{2,}$/.test(username)) return skip("اسم المستخدم غير صالح");
      if (seen.has(username)) return skip("مكرر في القائمة");
      const teamIds: string[] = [];
      for (const part of teamCell.split("+").map(norm).filter(Boolean)) {
        const id = teamByKey.get(part);
        if (!id) return skip(`فريق غير موجود: ${part}`);
        teamIds.push(id);
      }
      seen.add(username);
      rows.push({ username, fullName: name.replace(/\s+/g, " "), teamIds });
    });
    if (rows.length > 500) return { ok: false, error: "الحد الأقصى 500 مستخدم في المرة الواحدة" };

    const existing = new Set((await prisma.user.findMany({
      where: { username: { in: rows.map((r) => r.username) } }, select: { username: true },
    })).map((u) => u.username));
    const passwordHash = await bcrypt.hash(input.password, 10);
    let created = 0;
    for (const r of rows) {
      if (existing.has(r.username)) {
        skipped.push({ line: 0, text: r.username, reason: "موجود بالفعل" });
        continue;
      }
      await prisma.user.create({
        data: {
          username: r.username, fullName: r.fullName, role: role.data, passwordHash, mustChangePassword: true,
          teams: { create: r.teamIds.map((teamId) => ({ teamId })) },
        },
      });
      created++;
    }
    if (created > 0) await logSystem(me.id, "users_imported", { created });
    revalidatePath("/admin/users");
    return { ok: true, created, skipped };
  } catch (e) { return fail(e) as ImportResult; }
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
    const me = await requireManager();
    const parsed = teamSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "خطأ" };
    const d = { ...parsed.data, description: parsed.data.description || null };
    if (teamId && d.transferOnlyFromId === teamId) return { ok: false, error: "لا يمكن تقييد الفريق على نفسه" };
    const clash = await prisma.team.findFirst({ where: { name: d.name, NOT: teamId ? { id: teamId } : undefined } });
    if (clash) return { ok: false, error: "يوجد فريق بالاسم نفسه" };
    if (teamId) {
      const before = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });
      await prisma.team.update({ where: { id: teamId }, data: d });
      const yes = (b: boolean) => (b ? "نعم" : "لا");
      const changes: { label: string; from: string; to: string }[] = [];
      if (before.name !== d.name) changes.push({ label: "الاسم", from: before.name, to: d.name });
      if ((before.description ?? "") !== (d.description ?? "")) changes.push({ label: "الوصف", from: before.description ?? "—", to: d.description ?? "—" });
      if (before.isActive !== d.isActive) changes.push({ label: "نشط", from: yes(before.isActive), to: yes(d.isActive) });
      if (before.isReceiver !== d.isReceiver) changes.push({ label: "فريق استقبال", from: yes(before.isReceiver), to: yes(d.isReceiver) });
      if (before.color !== d.color) changes.push({ label: "اللون", from: before.color, to: d.color });
      if (before.transferOnlyFromId !== d.transferOnlyFromId) changes.push({ label: "قيد التحويل", from: before.transferOnlyFromId ? "مقيد" : "—", to: d.transferOnlyFromId ? "مقيد" : "—" });
      if (changes.length) await logSystem(me.id, "team_updated", { name: d.name, changes });
    } else {
      await prisma.team.create({ data: d });
      await logSystem(me.id, "team_created", { name: d.name });
    }
    revalidatePath("/tickets");
    return done();
  } catch (e) { return fail(e); }
}
