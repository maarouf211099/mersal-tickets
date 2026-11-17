// نسخة من ردود تقييم النظام في فولدر مشترك على السيرفر — سيستم الحالات بيقرا ملفات الأنظمة كلها
// ويعرضها في صفحة واحدة "نتائج تقييم الأنظمة".
//
// الفولدر: FEEDBACK_SHARED_DIR، والافتراضي C:\ProgramData\mersal-feedback على Windows (أو <tmp>/mersal-feedback)
// الملف: tickets.json — من غير أي userId أو username (نفس حقول GET /api/feedback بالظبط)
// بيتكتب بعد كل تقييم ناجح ومرة عند تشغيل السيرفر. أي فشل بيتسجل في اللوج بس — عمره ما بيوقّف التقييم أو النظام.
import { mkdir, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prisma } from "./prisma";
import { FEEDBACK_CAMPAIGN, FEEDBACK_SYSTEM, FEEDBACK_SYSTEM_NAME } from "./feedback";

export function feedbackSharedDir(): string {
  const fromEnv = (process.env.FEEDBACK_SHARED_DIR || "").trim();
  if (fromEnv) return fromEnv;
  return process.platform === "win32" ? "C:\\ProgramData\\mersal-feedback" : path.join(os.tmpdir(), "mersal-feedback");
}

// كل ردود الحملة، الأحدث الأول — من غير userId
export async function listFeedbackRows() {
  const rows = await prisma.feedback.findMany({
    where: { campaign: FEEDBACK_CAMPAIGN },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true, department: true, name: true, overall: true, ease: true, speed: true, value: true,
      problems: true, ideas: true,
    },
  });
  return rows.map((r) => ({ ...r, name: r.name ?? "", problems: r.problems ?? "", ideas: r.ideas ?? "" }));
}

async function writeOnce() {
  const rows = await listFeedbackRows();
  const dir = feedbackSharedDir();
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${FEEDBACK_SYSTEM}.json`);
  const tmp = `${file}.tmp`;
  const body = {
    system: FEEDBACK_SYSTEM,
    name: FEEDBACK_SYSTEM_NAME,
    campaign: FEEDBACK_CAMPAIGN,
    updatedAt: new Date().toISOString(),
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
  await writeFile(tmp, JSON.stringify(body), "utf8");
  try {
    await rename(tmp, file);
  } catch {
    // على Windows ممكن الملف يكون مفتوح للقراية لحظتها — نحاول تاني مرة واحدة
    await new Promise((r) => setTimeout(r, 300));
    await rename(tmp, file);
  }
}

// كتابة واحدة في نفس الوقت؛ لو جه طلب وهي شغالة بتتعاد مرة كمان بعدها بأحدث داتا
let running: Promise<void> | null = null;
let again = false;

export function exportFeedbackSnapshot(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await writeOnce();
      } while (again);
    } catch (e) {
      console.warn(`[mersal-tickets] feedback snapshot not written (${feedbackSharedDir()}): ${e instanceof Error ? e.message : e}`);
    } finally {
      running = null;
    }
  })();
  return running;
}
