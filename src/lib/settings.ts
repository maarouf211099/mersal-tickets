import "server-only";
import { cache } from "react";
import { prisma } from "./prisma";
import { CLOSE_CATEGORIES, SLA_MINUTES, type TicketType } from "./workflow";

export type Announcement = { text: string; tone: "info" | "warning" | "danger"; active: boolean };
export type Settings = {
  sla: Record<TicketType, number>; // بالدقايق
  closeCategories: string[];
  announcement: Announcement;
};

const DEFAULTS: Settings = {
  sla: { ...SLA_MINUTES },
  closeCategories: [...CLOSE_CATEGORIES],
  announcement: { text: "", tone: "info", active: false },
};

// إعدادات المدير — بتتقري مرة واحدة في كل request، ولو مفيش حاجة متسجلة بترجع القيم الافتراضية
export const getSettings = cache(async (): Promise<Settings> => {
  try {
    const rows = await prisma.setting.findMany();
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
    const sla = { ...DEFAULTS.sla, ...((m.sla as Partial<Settings["sla"]>) ?? {}) };
    for (const k of Object.keys(sla) as TicketType[]) if (!(sla[k] >= 1)) sla[k] = DEFAULTS.sla[k];
    const cats = Array.isArray(m.closeCategories) && m.closeCategories.length ? (m.closeCategories as string[]) : DEFAULTS.closeCategories;
    return { sla, closeCategories: cats, announcement: { ...DEFAULTS.announcement, ...((m.announcement as Partial<Announcement>) ?? {}) } };
  } catch {
    return DEFAULTS;
  }
});
