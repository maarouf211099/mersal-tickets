import type { ApprovalCategory, UserRole } from "@prisma/client";
import { isAdmin, isStaff } from "./permissions";

// نوع صلاحيات الموافقات المخزنة في User.approvalPerms
export type ApprovalPerms = Partial<Record<ApprovalCategory, boolean>>;

// المدير له كل الصلاحيات، المشرفون كذلك، الآخرون بناءً على approvalPerms
export function canAccessCategory(
  role: UserRole,
  perms: ApprovalPerms,
  category: ApprovalCategory,
): boolean {
  if (isAdmin(role) || isStaff(role)) return true;
  return perms[category] === true;
}

// الفئات المسموح للمستخدم بالوصول إليها
export function accessibleCategories(
  role: UserRole,
  perms: ApprovalPerms,
): ApprovalCategory[] {
  const all: ApprovalCategory[] = [
    "medications", "exceptions", "tests", "immunosuppressants",
    "physio", "dialysis", "operations", "supplies",
  ];
  if (isAdmin(role) || isStaff(role)) return all;
  return all.filter((c) => perms[c] === true);
}

export function hasAnyApprovalAccess(role: UserRole, perms: ApprovalPerms): boolean {
  return accessibleCategories(role, perms).length > 0;
}

// من يستطيع الموافقة/الرفض (الأطباء والمشرفون فقط)
export function canReviewApproval(role: UserRole): boolean {
  return isStaff(role) || isAdmin(role);
}
