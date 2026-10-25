"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { endSession, startSession } from "@/lib/auth";

// حماية بسيطة من تخمين كلمة المرور: 8 محاولات غلط كل 10 دقايق لكل يوزر/IP
const attempts = new Map<string, { n: number; until: number }>();
const WINDOW_MS = 10 * 60_000;

export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  if (!username || !password) return { error: "اكتب اسم المستخدم وكلمة المرور" };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${username}|${ip}`;
  const now = Date.now();
  const a = attempts.get(key);
  if (a && a.until > now && a.n >= 8) return { error: "محاولات كتير غلط — جرّب بعد 10 دقايق" };

  const user = await prisma.user.findUnique({ where: { username } });
  const ok = !!user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) {
    attempts.set(key, { n: (a && a.until > now ? a.n : 0) + 1, until: now + WINDOW_MS });
    return { error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
  }
  attempts.delete(key);
  await startSession(user.id);
  const safe = /^\/(?![\/\\])/.test(next) && !next.includes("\\");
  redirect(safe ? next : "/dashboard");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
