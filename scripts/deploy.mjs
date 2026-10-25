// نشر نظام التذاكر على السيرفر — بيشتغل على Windows و Linux
// بيستخدمه الـ GitHub Actions self-hosted runner (deploy.yml) أو يدوي: node scripts/deploy.mjs
//
// اللي بيعمله بالترتيب:
//   1. يقرا الإعدادات من DEPLOY_DIR/.env (الملف ده بيتعمل مرة واحدة على السيرفر ومش في الريبو)
//   2. prisma migrate deploy — بيلمس schema "tickets" بس، ومفيش أي حذف داتا
//   3. next build ونسخ النسخة الجاهزة لفولدر release جديد
//   4. إعادة تشغيل عملية pm2 اسمها "mersal-tickets" بس — ما بيقفلش أي node تاني على الجهاز
//   5. health check — لو فشل بيرجع للنسخة اللي قبلها
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const APP = "mersal-tickets";
const KEEP_RELEASES = 3;
const root = process.cwd();

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function run(cmd, args, env) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env, cwd: root, shell: process.platform === "win32" });
  return r.status === 0;
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

const deployDir = process.env.DEPLOY_DIR;
if (!deployDir) die("لازم تحدد DEPLOY_DIR (فولدر النشر على السيرفر) — في GitHub: Settings → Variables → DEPLOY_DIR");
const envFile = path.join(deployDir, ".env");
if (!existsSync(envFile)) die(`مفيش ملف إعدادات في ${envFile} — انسخ .env.example هناك وعدّله (مرة واحدة بس)`);

const appEnv = parseEnv(envFile);
for (const k of ["DATABASE_URL", "AUTH_SECRET"]) if (!appEnv[k]) die(`${k} ناقص في ${envFile}`);
if (!/[?&]schema=/.test(appEnv.DATABASE_URL)) {
  die("DATABASE_URL لازم يكون فيه ?schema=tickets عشان النظام ما يلمسش جداول أي سيستم تاني");
}
appEnv.PORT ||= "3005";
appEnv.HOSTNAME ||= "0.0.0.0";
appEnv.UPLOAD_DIR ||= path.join(deployDir, "uploads");
appEnv.NODE_ENV = "production";
mkdirSync(appEnv.UPLOAD_DIR, { recursive: true });

const env = { ...process.env, ...appEnv, NEXT_TELEMETRY_DISABLED: "1" };

// pm2 لازم يكون متسطب global على السيرفر (npm i -g pm2) — مش من node_modules بتاعة الـ runner
const pm2Check = spawnSync("pm2", ["-v"], { shell: process.platform === "win32", encoding: "utf8" });
if (pm2Check.status !== 0) die("pm2 مش متسطب على السيرفر: npm install -g pm2");

if (!run("npx", ["prisma", "migrate", "deploy"], env)) die("فشل تطبيق الـ migrations — مفيش أي حاجة اتغيرت في النسخة الشغالة");
if (!run("npm", ["run", "build"], env)) die("فشل الـ build — النسخة الشغالة زي ما هي");

// ─── نسخ الـ release ─────────────────────────────────────
const releases = path.join(deployDir, "releases");
mkdirSync(releases, { recursive: true });
const sha = (process.env.GITHUB_SHA || "manual").slice(0, 7);
const id = `${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}-${sha}`;
const rel = path.join(releases, id);
cpSync(path.join(root, ".next", "standalone"), rel, { recursive: true });
cpSync(path.join(root, ".next", "static"), path.join(rel, ".next", "static"), { recursive: true });
cpSync(path.join(root, "public"), path.join(rel, "public"), { recursive: true });
rmSync(path.join(rel, ".env"), { force: true }); // الإعدادات بتيجي من pm2 بس

const current = path.join(deployDir, "current-release.txt");
const previous = existsSync(current) ? readFileSync(current, "utf8").trim() : null;

function startRelease(releaseId) {
  const dir = path.join(releases, releaseId);
  const eco = {
    apps: [{
      name: APP,
      script: path.join(dir, "server.js"),
      cwd: dir,
      env: appEnv,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "800M",
      autorestart: true,
    }],
  };
  const ecoFile = path.join(deployDir, "ecosystem.config.json");
  writeFileSync(ecoFile, JSON.stringify(eco, null, 2));
  run("pm2", ["delete", APP], process.env); // أول مرة هيقول مش موجود — عادي
  return run("pm2", ["start", ecoFile], process.env);
}

async function healthy(port) {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (r.ok) return true;
    } catch {}
    await new Promise((res) => setTimeout(res, 2000));
  }
  return false;
}

if (!startRelease(id) || !(await healthy(appEnv.PORT))) {
  console.error("\n✖ النسخة الجديدة ما اشتغلتش — آخر لوج:");
  run("pm2", ["logs", APP, "--lines", "40", "--nostream"], process.env);
  if (previous && existsSync(path.join(releases, previous))) {
    console.error(`↩ رجوع للنسخة السابقة ${previous}`);
    startRelease(previous);
    run("pm2", ["save"], process.env);
  }
  process.exit(1);
}

writeFileSync(current, id);
run("pm2", ["save"], process.env);

// مسح النسخ القديمة
const all = readdirSync(releases).sort();
for (const old of all.slice(0, Math.max(0, all.length - KEEP_RELEASES))) {
  if (old !== id && old !== previous) rmSync(path.join(releases, old), { recursive: true, force: true });
}
console.log(`\n✔ تم النشر: ${id} على البورت ${appEnv.PORT}\n`);
