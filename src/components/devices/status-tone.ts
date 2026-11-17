import type { DeviceStatus } from "@/lib/workflow";
export const STATUS_TONE: Record<DeviceStatus, string> = {
  in_stock: "bg-emerald-100 text-emerald-800", with_patient: "bg-sky-100 text-sky-800",
  maintenance: "bg-amber-100 text-amber-800", out_of_stock: "bg-red-100 text-red-700",
};
