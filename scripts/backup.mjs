// نسخ احتياطي لقاعدة بيانات نظام التذاكر والمرفقات — يعمل على Windows وLinux
//
// التشغيل:  node scripts/backup.mjs
// الإعدادات تُقرأ من DEPLOY_DIR/.env (أو من متغيرات البيئة):
//   DATABASE_URL       قاعدة البيانات (إلزامي)
//   UPLOAD_DIR         مجلد المرفقات (افتراضيًا DEPLOY_DIR/uploads)
//   BACKUP_DIR         مكان النسخ (افتراضيًا DEPLOY_DIR/backups)
//   BACKUP_COPY_DIR    نسخة ثانية على قرص آخر أو مشاركة شبكة (اختياري، ومُستحسن جدًا)
//   BACKUP_KEEP_DAYS   مدة الاحتفاظ بالنسخ (افتراضيًا 14 يومًا)
//
// للحماية من برامج الفدية: انقل نسخة دوريًا إلى مكان لا يصل إليه السيرفر
// (قرص خارجي يُفصل بعد النسخ، أو تخزين سحابي يدعم الإصدارات/عدم القابلية للتعديل).
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

function die(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

function parseEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const deployDir = process.env.DEPLOY_DIR || "";
const fileEnv = deployDir && existsSync(path.join(deployDir, ".env")) ? parseEnv(path.join(deployDir, ".env")) : {};
const cfg = { ...fileEnv, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k in fileEnv || k.startsWith("BACKUP_") || k === "DATABASE_URL" || k === "UPLOAD_DIR")) };

if (!cfg.DATABASE_URL) die("DATABASE_URL غير محدد — عيّن DEPLOY_DIR أو DATABASE_URL");
const backupDir = cfg.BACKUP_DIR || (deployDir ? path.join(deployDir, "backups") : "");
if (!backupDir) die("حدّد BACKUP_DIR أو DEPLOY_DIR");
const uploadDir = cfg.UPLOAD_DIR || (deployDir ? path.join(deployDir, "uploads") : "");
const keepDays = Number(cfg.BACKUP_KEEP_DAYS || 14);

// pg_dump لا يقبل المعامل ?schema= — نزيله ونمرّر المخطط بـ --schema
const url = new URL(cfg.DATABASE_URL);
const schema = url.searchParams.get("schema") || "public";
url.search = "";

mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 13);
const dbFile = path.join(backupDir, `mersal-tickets-db-${stamp}.dump`);
const filesFile = path.join(backupDir, `mersal-tickets-uploads-${stamp}.tar.gz`);
const shell = process.platform === "win32";

console.log(`• نسخ قاعدة البيانات (المخطط ${schema}) ...`);
const dump = spawnSync("pg_dump", ["--format=custom", "--no-owner", `--schema=${schema}`, `--file=${dbFile}`, url.toString()],
  { stdio: ["ignore", "inherit", "inherit"], shell });
if (dump.error?.code === "ENOENT" || dump.status === 127 || (shell && dump.status === 1 && !existsSync(dbFile))) {
  die("pg_dump غير موجود في PATH — أضف مجلد bin الخاص بـ PostgreSQL إلى PATH");
}
if (dump.status !== 0) die("فشل pg_dump");
console.log(`  ✔ ${dbFile} (${(statSync(dbFile).size / 1024).toFixed(0)} KB)`);

const made = [dbFile];
if (uploadDir && existsSync(uploadDir)) {
  console.log("• نسخ المرفقات ...");
  // tar موجود في Linux وفي Windows 10 وما بعده
  const tar = spawnSync("tar", ["-czf", filesFile, "-C", uploadDir, "."], { stdio: "inherit", shell });
  if (tar.status !== 0) die("فشل ضغط مجلد المرفقات");
  console.log(`  ✔ ${filesFile} (${(statSync(filesFile).size / 1024).toFixed(0)} KB)`);
  made.push(filesFile);
} else {
  console.log("• لا يوجد مجلد مرفقات بعد — تم تخطيه");
}

if (cfg.BACKUP_COPY_DIR) {
  try {
    mkdirSync(cfg.BACKUP_COPY_DIR, { recursive: true });
    for (const f of made) copyFileSync(f, path.join(cfg.BACKUP_COPY_DIR, path.basename(f)));
    console.log(`• ✔ نسخة ثانية في ${cfg.BACKUP_COPY_DIR}`);
  } catch (e) {
    console.error(`✖ تعذّر النسخ إلى ${cfg.BACKUP_COPY_DIR}: ${e.message}`);
    process.exitCode = 1;
  }
}

// حذف النسخ الأقدم من مدة الاحتفاظ (لا يُحذف من BACKUP_COPY_DIR)
const cutoff = Date.now() - keepDays * 86_400_000;
for (const f of readdirSync(backupDir)) {
  if (!f.startsWith("mersal-tickets-")) continue;
  const full = path.join(backupDir, f);
  if (statSync(full).mtimeMs < cutoff) rmSync(full);
}
console.log(`✔ اكتمل النسخ الاحتياطي (الاحتفاظ ${keepDays} يومًا)`);
