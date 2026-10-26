# فحص سيرفر Windows بحثًا عن آثار الاختراق وبرامج الفدية — قراءة فقط، لا يغيّر أي شيء
# التشغيل (PowerShell كمسؤول):
#   powershell -ExecutionPolicy Bypass -File security\check-windows.ps1 -ProjectPath "C:\mersal-tickets" | Tee-Object check-report.txt
#
# أي سطر يبدأ بـ [!] يحتاج إلى مراجعة.

param(
  # مجلد النسخة القديمة من النظام (إن وُجد) ليُفحص بالكامل
  [string]$ProjectPath = ""
)

$ErrorActionPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$script:Warn = 0
function Warn($m) { Write-Host "[!] $m" -ForegroundColor Yellow; $script:Warn++ }
function Ok($m)   { Write-Host "[OK] $m" -ForegroundColor Green }
function Sec($m)  { Write-Host ""; Write-Host "=== $m ===" -ForegroundColor Cyan }

$IocSha256 = "E7ED560665EC93E02779D4B62DB73FF7914B1B631330CE31DF756E41047AF4C7"
$IocIps = @("107.175.114.96", "156.246.94.183")
$IocNames = @("let", "let;chmod", "p.sh", "alive.sh", "kinsing", "kdevtmpfsi", "xmrig*", "nanominer*", "*.miner.exe")
$MiningPorts = @(3333, 4444, 5555, 7777, 8888, 9999, 14433, 14444, 45560, 45700)
$RansomNotes = @("*DECRYPT*", "*RECOVER*FILES*", "*RESTORE*FILES*", "*HOW_TO*", "*READ_ME*", "*!README!*", "*_readme.txt")

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Host "يُفضَّل تشغيل PowerShell كمسؤول (Run as Administrator) ليكون الفحص كاملًا." }
Write-Host "تاريخ الفحص: $(Get-Date)   الجهاز: $env:COMPUTERNAME"

# المجلدات الأكثر عرضة لاستضافة البرامج الخبيثة
$Roots = @("$env:SystemDrive\Users", "$env:ProgramData", "$env:SystemRoot\Temp", "$env:SystemDrive\inetpub")
if ($ProjectPath) { $Roots += $ProjectPath }
$Roots = $Roots | Where-Object { $_ -and (Test-Path $_) }

Sec "1. ملفات بأسماء البرنامج الخبيث"
foreach ($root in $Roots) {
  foreach ($n in $IocNames) {
    Get-ChildItem -Path $root -Filter $n -Recurse -File -Force |
      Where-Object { $_.FullName -notmatch "\\node_modules\\" } |
      ForEach-Object {
        $h = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
        if ($h -eq $IocSha256) { Warn "مطابق تمامًا للعينة الخبيثة: $($_.FullName)" }
        else { Warn "ملف باسم مشبوه (راجعه): $($_.FullName)" }
      }
  }
}

Sec "2. برامج تنفيذية في مجلدات مؤقتة ومجلدات المستخدمين"
$tempDirs = @("$env:SystemRoot\Temp") + (Get-ChildItem "$env:SystemDrive\Users" -Directory | ForEach-Object { "$($_.FullName)\AppData\Local\Temp", "$($_.FullName)\AppData\Roaming" })
foreach ($d in $tempDirs | Where-Object { Test-Path $_ }) {
  Get-ChildItem $d -Include *.exe, *.scr, *.ps1, *.bat, *.vbs -Recurse -File -Force |
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-90) -and $_.FullName -notmatch "\\(Microsoft|Google|Mozilla|npm-cache)\\" } |
    Select-Object -First 30 |
    ForEach-Object { Warn "برنامج حديث في مجلد مؤقت (راجعه): $($_.FullName)" }
}

Sec "3. العمليات"
Write-Host "أعلى 10 عمليات استهلاكًا للمعالج (إجمالي الثواني):"
Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 Id, ProcessName, CPU, @{n = "MB"; e = { [int]($_.WorkingSet64 / 1MB) } }, Path | Format-Table -AutoSize | Out-String | Write-Host
Get-Process | Where-Object { $_.Path -match "\\(Temp|AppData\\Roaming|AppData\\Local\\Temp|ProgramData)\\" -and $_.Path -notmatch "\\(Microsoft|Packages)\\" } |
  ForEach-Object { Warn "عملية تعمل من مجلد مؤقت أو ProgramData: $($_.ProcessName) (PID $($_.Id)) — $($_.Path)" }
Get-Process | Where-Object { $_.ProcessName -match "xmrig|miner|kinsing|kdevtmpfsi" } |
  ForEach-Object { Warn "عملية باسم برنامج تعدين: $($_.ProcessName) (PID $($_.Id)) — $($_.Path)" }

Sec "4. الشبكة"
$conns = Get-NetTCPConnection
foreach ($ip in $IocIps) {
  $conns | Where-Object { $_.RemoteAddress -eq $ip } | ForEach-Object {
    Warn "اتصال بعنوان معروف للبرنامج الخبيث $ip من العملية $((Get-Process -Id $_.OwningProcess).ProcessName)"
  }
}
$conns | Where-Object { $_.State -eq "Established" -and $MiningPorts -contains $_.RemotePort } | ForEach-Object {
  Warn "اتصال قائم على منفذ تعدين شائع $($_.RemotePort) إلى $($_.RemoteAddress) — العملية $((Get-Process -Id $_.OwningProcess).ProcessName)"
}
Write-Host "المنافذ المفتوحة للاستماع (تأكد أن كل منفذ منها مقصود):"
$conns | Where-Object { $_.State -eq "Listen" -and $_.LocalAddress -notin @("127.0.0.1", "::1") } |
  Sort-Object LocalPort -Unique |
  ForEach-Object { Write-Host ("    {0}:{1}  {2}" -f $_.LocalAddress, $_.LocalPort, (Get-Process -Id $_.OwningProcess).ProcessName) }
if ($conns | Where-Object { $_.State -eq "Listen" -and $_.LocalPort -eq 5432 -and $_.LocalAddress -in @("0.0.0.0", "::") }) {
  Warn "PostgreSQL يستمع على كل العناوين — يجب أن يقتصر على localhost (listen_addresses = 'localhost')"
}
$rdp = Get-ItemProperty "HKLM:\System\CurrentControlSet\Control\Terminal Server" -Name fDenyTSConnections
if ($rdp.fDenyTSConnections -eq 0) {
  Warn "سطح المكتب البعيد (RDP) مفعّل — لا تعرضه على الإنترنت مطلقًا، واستخدم VPN"
}

Sec "5. التشغيل التلقائي والمهام المجدولة"
Get-ScheduledTask | Where-Object { $_.TaskPath -notlike "\Microsoft\*" -and $_.State -ne "Disabled" } | ForEach-Object {
  $act = ($_.Actions | ForEach-Object { "$($_.Execute) $($_.Arguments)" }) -join " ; "
  Write-Host "    مهمة: $($_.TaskPath)$($_.TaskName) -> $act"
  if ($act -match "powershell.*-enc|-e |iex|downloadstring|bitsadmin|certutil|mshta|\\Temp\\|AppData|curl|wget") {
    Warn "مهمة مجدولة مريبة: $($_.TaskPath)$($_.TaskName) -> $act"
  }
}
foreach ($k in @("HKLM:\Software\Microsoft\Windows\CurrentVersion\Run", "HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce",
                 "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run", "HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce")) {
  $p = Get-ItemProperty $k
  if ($p) {
    $p.PSObject.Properties | Where-Object { $_.Name -notlike "PS*" } | ForEach-Object {
      Write-Host "    تشغيل تلقائي ($k): $($_.Name) = $($_.Value)"
      if ($_.Value -match "\\Temp\\|AppData\\Roaming|powershell.*-enc|mshta|wscript") { Warn "تشغيل تلقائي مريب: $($_.Name) = $($_.Value)" }
    }
  }
}
Get-CimInstance Win32_Service | Where-Object { $_.PathName -match "\\Users\\|\\Temp\\|\\ProgramData\\" -and $_.PathName -notmatch "Microsoft" } |
  ForEach-Object { Warn "خدمة تعمل من مسار غير معتاد: $($_.Name) — $($_.PathName)" }

Sec "6. الحسابات"
Write-Host "أعضاء مجموعة المسؤولين (Administrators):"
Get-LocalGroupMember -Group "Administrators" | ForEach-Object { Write-Host "    $($_.Name)" }
Get-LocalUser | Where-Object { $_.Enabled } | ForEach-Object {
  Write-Host "    مستخدم نشط: $($_.Name)  آخر دخول: $($_.LastLogon)  آخر تغيير لكلمة المرور: $($_.PasswordLastSet)"
}
$recentUsers = Get-WinEvent -FilterHashtable @{ LogName = "Security"; Id = 4720; StartTime = (Get-Date).AddDays(-90) } -MaxEvents 20
foreach ($e in $recentUsers) { Warn "أُنشئ حساب جديد في $($e.TimeCreated): $($e.Properties[0].Value)" }
$failed = (Get-WinEvent -FilterHashtable @{ LogName = "Security"; Id = 4625; StartTime = (Get-Date).AddDays(-1) } -MaxEvents 2000).Count
if ($failed -gt 50) { Warn "محاولات دخول فاشلة كثيرة خلال 24 ساعة: $failed — قد تكون محاولة تخمين كلمات مرور" }

Sec "7. علامات برامج الفدية (Ransomware)"
foreach ($root in $Roots) {
  foreach ($n in $RansomNotes) {
    Get-ChildItem -Path $root -Filter $n -Recurse -File -Force -Include *.txt, *.html, *.hta |
      Where-Object { $_.FullName -notmatch "\\node_modules\\" } |
      Select-Object -First 10 |
      ForEach-Object { Warn "ملف قد يكون رسالة فدية (راجعه): $($_.FullName)" }
  }
}
$shadows = (vssadmin list shadows 2>$null | Select-String "Shadow Copy ID").Count
if ($isAdmin) {
  if ($shadows -eq 0) { Warn "لا توجد نسخ ظل (Shadow Copies) — برامج الفدية تحذفها عادة، وقد تكون غير مفعّلة أصلًا" }
  else { Ok "يوجد $shadows من نسخ الظل" }
}

Sec "8. الحماية الأساسية"
$mp = Get-MpComputerStatus
if ($mp) {
  if ($mp.RealTimeProtectionEnabled) { Ok "الحماية الفورية في Microsoft Defender مفعّلة" } else { Warn "الحماية الفورية في Microsoft Defender متوقفة" }
  if ($mp.AntivirusSignatureAge -gt 3) { Warn "تعريفات Defender قديمة ($($mp.AntivirusSignatureAge) أيام)" }
  if ($mp.FullScanAge -gt 30) { Warn "لم يُجرَ فحص كامل منذ $($mp.FullScanAge) يومًا — شغّل: Start-MpScan -ScanType FullScan" }
  $threats = Get-MpThreatDetection
  foreach ($t in $threats) { Warn "اكتشف Defender تهديدًا في $($t.InitialDetectionTime): $((Get-MpThreat -ThreatID $t.ThreatID).ThreatName) — $($t.Resources -join ', ')" }
  $pref = Get-MpPreference
  if ($pref.EnableControlledFolderAccess -eq 1) { Ok "الوصول المتحكَّم فيه إلى المجلدات (الحماية من برامج الفدية) مفعّل" }
  else { Warn "الحماية من برامج الفدية (Controlled Folder Access) غير مفعّلة" }
} else { Warn "تعذّرت قراءة حالة Microsoft Defender — تأكد من وجود برنامج حماية يعمل" }
$fw = Get-NetFirewallProfile | Where-Object { -not $_.Enabled }
foreach ($p in $fw) { Warn "جدار الحماية متوقف في الملف الشخصي: $($p.Name)" }
if (-not $fw) { Ok "جدار الحماية في Windows مفعّل في كل الملفات الشخصية" }
$lastUpdate = Get-HotFix | Where-Object { $_.InstalledOn } | Sort-Object InstalledOn -Descending | Select-Object -First 1
if ($lastUpdate -and $lastUpdate.InstalledOn -lt (Get-Date).AddDays(-45)) { Warn "آخر تحديث لـ Windows مثبت في $($lastUpdate.InstalledOn) — النظام غير محدَّث" }
$smb1 = Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol
if ($smb1.State -eq "Enabled") { Warn "بروتوكول SMBv1 مفعّل — يستغله كثير من برامج الفدية، عطّله" }

Sec "النتيجة"
if ($script:Warn -eq 0) {
  Write-Host "لم يُعثر على تحذيرات. هذا لا يضمن خلو الجهاز تمامًا؛ أعد الفحص دوريًا." -ForegroundColor Green
} else {
  Write-Host "عدد التحذيرات: $($script:Warn) — راجع كل سطر يبدأ بـ [!] أعلاه." -ForegroundColor Yellow
  Write-Host "إذا ظهر ملف مطابق للعينة، أو اتصال بالعناوين المعروفة، أو تهديد اكتشفه Defender، أو رسالة فدية:"
  Write-Host "فالجهاز مخترق ويجب عزله عن الشبكة وإعادة تثبيته (انظر security\README.md)."
}
