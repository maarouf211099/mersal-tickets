import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

// المرفقات بتتحفظ على الديسك برّه فولدر الكود (UPLOAD_DIR) عشان ما تتمسحش مع كل نشر
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 5;

const ALLOWED: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
};
export const ACCEPT_ATTR = Object.keys(ALLOWED).join(",");

// بيتعرض في المتصفح مباشرة؛ أي نوع تاني بيتنزل كملف
export const INLINE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function uploadRoot() {
  return path.resolve(process.env.UPLOAD_DIR || "./uploads");
}

export function pickFiles(form: FormData, field = "files"): File[] {
  return form.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
}

export function validateFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) return `الحد الأقصى ${MAX_FILES} ملفات في المرة`;
  for (const f of files) {
    const ext = path.extname(f.name).toLowerCase();
    if (!ALLOWED[ext]) return `نوع الملف غير مسموح: ${f.name}`;
    if (f.size > MAX_FILE_BYTES) return `الملف ${f.name} أكبر من 10 ميجا`;
  }
  return null;
}

export async function saveFile(file: File) {
  const ext = path.extname(file.name).toLowerCase();
  const d = new Date();
  const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${randomUUID()}${ext}`;
  const full = path.join(uploadRoot(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return {
    storageKey: key,
    fileName: path.basename(file.name).slice(0, 200),
    mimeType: ALLOWED[ext],
    size: file.size,
  };
}

function safePath(key: string) {
  const root = uploadRoot();
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("invalid key");
  return full;
}

export async function readStoredFile(key: string) {
  return readFile(safePath(key));
}

export async function removeStoredFile(key: string) {
  await unlink(safePath(key)).catch(() => {});
}
