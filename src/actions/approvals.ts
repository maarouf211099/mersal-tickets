"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessCategory, canReviewApproval, type ApprovalPerms } from "@/lib/approval-permissions";
import { nextApprovalNumber } from "@/lib/approval-number";
import type { ApprovalCategory, ApprovalStatus } from "@prisma/client";

async function requireUser() {
  const s = await auth();
  if (!s?.user) throw new Error("غير مسجَّل الدخول");
  return s.user;
}

const CATEGORIES = z.enum([
  "medications", "exceptions", "tests", "immunosuppressants",
  "physio", "dialysis", "operations", "supplies",
]);

const createSchema = z.object({
  category:         CATEGORIES,
  caseCode:         z.string().min(1, "كود الحالة مطلوب"),
  patientName:      z.string().min(1, "اسم المريض مطلوب"),
  specialty:        z.string().optional().nullable(),
  service:          z.string().optional().nullable(),
  month:            z.string().optional().nullable(),
  prescriptionLink: z.string().optional().nullable(),
  prescriptionDate: z.string().optional().nullable(),
  uploaderNotes:    z.string().optional().nullable(),
  extra:            z.record(z.any()).optional().default({}),
});

export async function createApproval(input: unknown) {
  const user = await requireUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "خطأ" };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, approvalPerms: true, teams: { select: { teamId: true }, take: 1 } },
  });
  if (!dbUser) return { ok: false as const, error: "المستخدم غير موجود" };

  const perms = (dbUser.approvalPerms ?? {}) as ApprovalPerms;
  if (!canAccessCategory(dbUser.role, perms, parsed.data.category)) {
    return { ok: false as const, error: "ليست لديك صلاحية لإضافة هذا النوع من الموافقات" };
  }

  const number = await nextApprovalNumber(parsed.data.category);
  const approval = await prisma.approval.create({
    data: {
      approvalNumber:   number,
      category:         parsed.data.category,
      caseCode:         parsed.data.caseCode.trim(),
      patientName:      parsed.data.patientName.trim(),
      specialty:        parsed.data.specialty ?? null,
      service:          parsed.data.service ?? null,
      month:            parsed.data.month ?? null,
      prescriptionLink: parsed.data.prescriptionLink ?? null,
      prescriptionDate: parsed.data.prescriptionDate ? new Date(parsed.data.prescriptionDate) : null,
      uploaderNotes:    parsed.data.uploaderNotes ?? null,
      extra:            parsed.data.extra ?? {},
      createdById:      user.id,
      teamId:           dbUser.teams[0]?.teamId ?? null,
    },
  });

  revalidatePath("/approvals");
  return { ok: true as const, approvalId: approval.id };
}

const reviewSchema = z.object({
  status:          z.enum(["approved", "rejected", "needs_info", "under_review", "dispensed", "closed"]),
  writtenApproval: z.string().optional().nullable(),
  approvalType:    z.string().optional().nullable(),
});

export async function reviewApproval(id: string, input: unknown) {
  const user = await requireUser();
  if (!canReviewApproval(user.role)) return { ok: false as const, error: "غير مصرح" };

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "خطأ" };

  await prisma.approval.update({
    where: { id },
    data: {
      status:          parsed.data.status as ApprovalStatus,
      writtenApproval: parsed.data.writtenApproval ?? null,
      approvalType:    parsed.data.approvalType ?? null,
      reviewerId:      user.id,
      reviewedAt:      new Date(),
    },
  });
  revalidatePath("/approvals");
  revalidatePath(`/approvals/${id}`);
  return { ok: true as const };
}

const receiptSchema = z.object({
  receiptStatus:      z.string().optional().nullable(),
  receiptDate:        z.string().optional().nullable(),
  closingResponsible: z.string().optional().nullable(),
  finalNotes:         z.string().optional().nullable(),
});

export async function updateReceipt(id: string, input: unknown) {
  const user = await requireUser();
  if (!canReviewApproval(user.role)) return { ok: false as const, error: "غير مصرح" };

  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "خطأ" };

  await prisma.approval.update({
    where: { id },
    data: {
      receiptStatus:      parsed.data.receiptStatus ?? null,
      receiptDate:        parsed.data.receiptDate ? new Date(parsed.data.receiptDate) : null,
      closingResponsible: parsed.data.closingResponsible ?? null,
      finalNotes:         parsed.data.finalNotes ?? null,
    },
  });
  revalidatePath(`/approvals/${id}`);
  return { ok: true as const };
}

export async function deleteApproval(id: string) {
  const user = await requireUser();
  if (user.role !== "manager") throw new Error("غير مصرح");
  await prisma.approval.delete({ where: { id } });
  revalidatePath("/approvals");
}

// تحديث صلاحيات الموافقات لمستخدم معين
const permsSchema = z.record(z.boolean());

export async function updateApprovalPerms(userId: string, perms: unknown) {
  const user = await requireUser();
  if (user.role !== "manager") throw new Error("غير مصرح");
  const parsed = permsSchema.safeParse(perms);
  if (!parsed.success) return { ok: false as const, error: "بيانات غير صحيحة" };

  await prisma.user.update({
    where: { id: userId },
    data:  { approvalPerms: parsed.data },
  });
  revalidatePath("/admin/users");
  return { ok: true as const };
}
