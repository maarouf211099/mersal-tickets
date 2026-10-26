#!/usr/bin/env bash
# فحص سيرفر Linux بحثًا عن آثار الاختراق — قراءة فقط، لا يغيّر أي شيء
# التشغيل:  sudo bash security/check-linux.sh | tee check-report.txt
#
# يبحث عن آثار برنامج التعدين الذي وُجد في ملفات النسخة القديمة (let / let;chmod)
# وعن علامات الاختراق الشائعة الأخرى. أي سطر يبدأ بـ ⚠ يحتاج إلى مراجعة.

set -u
WARN=0
warn() { echo "⚠  $*"; WARN=$((WARN + 1)); }
ok()   { echo "✓  $*"; }
sec()  { echo; echo "═══ $* ═══"; }

# مؤشرات الاختراق المعروفة من العينة التي فُحصت
IOC_SHA256="e7ed560665ec93e02779d4b62db73ff7914b1b631330ce31df756e41047af4c7"
IOC_IPS="107.175.114.96 156.246.94.183"
IOC_NAMES="let let;chmod p.sh alive.sh kinsing kdevtmpfsi xmrig xmrig-notls"
MINING_PORTS="3333 4444 5555 7777 8888 9999 14433 14444 45560 45700"

[ "$(id -u)" -ne 0 ] && echo "ℹ  يُفضَّل التشغيل بـ sudo حتى يرى الفحص كل العمليات والملفات."
echo "تاريخ الفحص: $(date)   الجهاز: $(hostname)"

sec "١. ملفات بأسماء البرنامج الخبيث"
for n in $IOC_NAMES; do
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    h=$(sha256sum "$f" 2>/dev/null | cut -d' ' -f1)
    if [ "$h" = "$IOC_SHA256" ]; then warn "مطابق تمامًا للعينة الخبيثة: $f"
    else warn "ملف باسم مشبوه (راجعه): $f"; fi
  done < <(find / -xdev -type f -name "$n" -not -path "/proc/*" -not -path "*/node_modules/*" 2>/dev/null)
done
while IFS= read -r f; do
  warn "health.sh خارج node_modules (قد يكون سليمًا، راجعه): $f"
done < <(find / -xdev -type f -name health.sh -not -path "*/node_modules/*" -not -path "/proc/*" 2>/dev/null)

sec "٢. ملفات تنفيذية في المجلدات المؤقتة"
for d in /tmp /var/tmp /dev/shm; do
  while IFS= read -r f; do
    warn "ملف تنفيذي في $d: $f ($(file -b "$f" 2>/dev/null | cut -c1-60))"
  done < <(find "$d" -type f \( -perm -u+x -o -name "*.sh" \) 2>/dev/null | head -50)
done

sec "٣. العمليات"
echo "أعلى 10 عمليات استهلاكًا للمعالج:"
ps -eo pid,user,%cpu,%mem,etime,comm --sort=-%cpu | head -11
while read -r pid cpu comm; do
  warn "عملية تستهلك ${cpu}% من المعالج: $comm (PID $pid) — $(readlink "/proc/$pid/exe" 2>/dev/null)"
done < <(ps -eo pid,%cpu,comm --sort=-%cpu --no-headers | awk '$2 > 80')
for p in /proc/[0-9]*; do
  exe=$(readlink "$p/exe" 2>/dev/null) || continue
  case "$exe" in
    *"(deleted)"*) warn "عملية تعمل من ملف محذوف (علامة شائعة للبرامج الخبيثة): PID ${p#/proc/} — $exe" ;;
    /tmp/*|/var/tmp/*|/dev/shm/*) warn "عملية تعمل من مجلد مؤقت: PID ${p#/proc/} — $exe" ;;
  esac
done

sec "٤. الشبكة"
CONN=$(ss -tunap 2>/dev/null || netstat -tunap 2>/dev/null)
for ip in $IOC_IPS; do
  if echo "$CONN" | grep -q "$ip"; then
    warn "اتصال بعنوان معروف للبرنامج الخبيث $ip:"; echo "$CONN" | grep "$ip"
  fi
done
for port in $MINING_PORTS; do
  if echo "$CONN" | grep -E "ESTAB" | grep -qE ":$port\b"; then
    warn "اتصال قائم على منفذ تعدين شائع $port:"; echo "$CONN" | grep -E "ESTAB" | grep -E ":$port\b"
  fi
done
echo "المنافذ المفتوحة للاستماع (تأكد أن كل منفذ منها مقصود):"
(ss -tulnp 2>/dev/null || netstat -tulnp 2>/dev/null) | grep -E "LISTEN|UNCONN" | awk '{print "   ", $1, $5, $7}'
if (ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) | grep -qE "0\.0\.0\.0:5432|\*:5432|\[::\]:5432"; then
  warn "PostgreSQL يستمع على كل العناوين — يجب أن يقتصر على localhost (listen_addresses = 'localhost')"
fi

sec "٥. المهام المجدولة والتشغيل التلقائي"
while IFS= read -r u; do
  c=$(crontab -l -u "$u" 2>/dev/null | grep -vE "^\s*(#|$)")
  [ -n "$c" ] && echo "crontab للمستخدم $u:" && echo "$c" | sed 's/^/    /'
done < <(cut -d: -f1 /etc/passwd)
while IFS= read -r l; do
  warn "سطر مريب في cron: $l"
done < <(grep -rhE "curl|wget|base64|/tmp/|/dev/shm" /etc/cron* /var/spool/cron 2>/dev/null | grep -v "^\s*#")
while IFS= read -r f; do
  warn "خدمة systemd أُضيفت أو عُدّلت يدويًا خلال 90 يومًا (راجعها): $f"
done < <(find /etc/systemd/system -name "*.service" -type f -mtime -90 2>/dev/null)
[ -s /etc/ld.so.preload ] && warn "/etc/ld.so.preload غير فارغ — علامة قوية على rootkit: $(cat /etc/ld.so.preload)"
if [ -f /etc/rc.local ] && grep -vE "^\s*(#|$|exit 0)" /etc/rc.local | grep -q .; then
  warn "/etc/rc.local يحتوي أوامر (راجعه)"
fi

sec "٦. الحسابات والمفاتيح"
while IFS= read -r u; do warn "مستخدم بصلاحية root غير root: $u"; done < <(awk -F: '$3 == 0 && $1 != "root" {print $1}' /etc/passwd)
echo "المستخدمون الذين لهم shell:"
awk -F: '$7 !~ /(nologin|false)$/ {print "    " $1 " (UID " $3 ")"}' /etc/passwd
for home in /root /home/*; do
  k="$home/.ssh/authorized_keys"
  [ -f "$k" ] || continue
  echo "مفاتيح SSH في $k (آخر تعديل: $(date -r "$k" '+%Y-%m-%d')):"
  awk '{print "    " $NF}' "$k"
  [ -n "$(find "$k" -mtime -90)" ] && warn "authorized_keys عُدّل خلال 90 يومًا: $k — تأكد أن كل مفتاح معروف"
done
if [ -f /etc/ssh/sshd_config ]; then
  if grep -qiE "^\s*PasswordAuthentication\s+no" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null; then
    ok "الدخول بكلمة مرور عبر SSH مُعطَّل"
  else warn "الدخول بكلمة مرور عبر SSH مسموح — يُفضَّل المفاتيح فقط"; fi
  if grep -qiE "^\s*PermitRootLogin\s+(no|prohibit-password)" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null; then
    ok "دخول root عبر SSH مقيَّد"
  else warn "دخول root عبر SSH غير مقيَّد"; fi
fi

sec "٧. ملفات النظام المعدّلة حديثًا"
find /usr/bin /usr/sbin /bin /sbin -type f -mtime -30 2>/dev/null | head -20 | sed 's/^/    عُدّل خلال 30 يومًا: /'
echo "    (التعديل الناتج عن تحديثات النظام طبيعي — ابحث عن أسماء غريبة)"

sec "٨. الحماية الأساسية"
if command -v ufw >/dev/null; then
  if ufw status 2>/dev/null | grep -q "Status: active"; then ok "الجدار الناري ufw مفعّل"; else warn "الجدار الناري ufw غير مفعّل"; fi
elif iptables -S 2>/dev/null | grep -q -- "-P INPUT DROP"; then ok "iptables يمنع الوارد افتراضيًا"
else warn "لا يوجد جدار ناري يمنع الاتصالات الواردة افتراضيًا"; fi
if [ -f /etc/apt/apt.conf.d/20auto-upgrades ] && grep -q '"1"' /etc/apt/apt.conf.d/20auto-upgrades; then
  ok "التحديثات الأمنية التلقائية مفعّلة"
else warn "التحديثات الأمنية التلقائية غير مفعّلة (unattended-upgrades)"; fi
if command -v fail2ban-client >/dev/null; then ok "fail2ban مثبت"; else warn "fail2ban غير مثبت (يحمي من تخمين كلمات المرور)"; fi

sec "النتيجة"
if [ "$WARN" -eq 0 ]; then
  echo "✓ لم يُعثر على تحذيرات. هذا لا يضمن خلو الجهاز تمامًا؛ أعد الفحص دوريًا."
else
  echo "⚠ عدد التحذيرات: $WARN — راجع كل سطر يبدأ بـ ⚠ أعلاه."
  echo "  إذا ظهر ملف مطابق للعينة، أو عملية من ملف محذوف، أو اتصال بالعناوين المعروفة:"
  echo "  فالجهاز مخترق ويجب عزله وإعادة تثبيته (انظر security/README.md)."
fi
