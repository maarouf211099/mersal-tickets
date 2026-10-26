#!/usr/bin/env bash
# نشر سريع لنظام التذاكر على Linux — أمر واحد:
#   bash deploy.sh                      (يستخدم /opt/mersal-tickets)
#   bash deploy.sh /path/to/deploy-dir
# آمن للإعادة: كل مرة يبني نسخة جديدة ويعيد تشغيل "mersal-tickets" فقط في pm2.
set -euo pipefail
cd "$(dirname "$0")"
DEPLOY_DIR="${1:-${DEPLOY_DIR:-/opt/mersal-tickets}}"

command -v node >/dev/null || { echo "✖ Node.js غير مثبت — ثبّت الإصدار 22"; exit 1; }
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || { echo "✖ يلزم Node.js 20 أو أحدث"; exit 1; }
command -v pm2 >/dev/null || { echo "• تثبيت pm2 ..."; npm install -g pm2; }

mkdir -p "$DEPLOY_DIR"
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  if [ -f .env.production ]; then
    cp .env.production "$DEPLOY_DIR/.env"; chmod 600 "$DEPLOY_DIR/.env"
    echo "• نُسخ .env.production إلى $DEPLOY_DIR/.env"
  else
    cp .env.example "$DEPLOY_DIR/.env"; chmod 600 "$DEPLOY_DIR/.env"
    echo "✖ أنشأتُ $DEPLOY_DIR/.env من القالب — عدّله (DATABASE_URL وAUTH_SECRET) ثم أعد تشغيل هذا السكربت"; exit 1
  fi
fi

echo "• تثبيت الحزم ..."
npm ci --no-audit --no-fund
DEPLOY_DIR="$DEPLOY_DIR" node scripts/deploy.mjs
PORT=$(grep -E '^PORT=' "$DEPLOY_DIR/.env" | cut -d= -f2 | tr -d '"' || true)
echo "✔ النظام يعمل: http://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT:-3005}"
echo "  تشغيله تلقائيًا مع إعادة تشغيل الجهاز (مرة واحدة): pm2 startup ثم نفّذ الأمر الذي يظهر"
