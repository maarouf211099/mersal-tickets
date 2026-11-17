/*
 * mersal-feedback.js — تقييم النظام من جوه النظام نفسه
 *
 * - للموظفين: رسالة منبثقة تظهر مرة واحدة بعد الدخول، فيها أسئلة التقييم، والرد بيتسجل في قاعدة بيانات النظام.
 * - للأدمن: زرار صغير "نتائج التقييم" بيفتح ملخص الردود وتحميل Excel.
 *
 * الإعدادات (كل نظام بيحددها قبل ما يحمّل الملف):
 *   window.MERSAL_FEEDBACK = {
 *     system:  'cases',                 // مفتاح ثابت للنظام
 *     name:    'سيستم الحالات',         // اسم النظام في الرسالة
 *     until:   '2026-11-30',            // بعد التاريخ ده رسالة التقييم مش بتظهر (النتايج تفضل متاحة للأدمن)
 *     ready:   function () {},          // true لما المستخدم يكون داخل
 *     user:    function () {},          // معرّف المستخدم (عشان الرسالة تظهر مرة لكل مستخدم على نفس الجهاز)
 *     submit:  function (data) {},      // Promise: يبعت الرد للسيرفر (POST /api/feedback)
 *     mine:    function () {},          // اختياري — Promise<boolean>: هل المستخدم قيّم قبل كده (من أي جهاز)
 *     canViewResults: function () {},   // اختياري — true للأدمن/المدير
 *     results: function () {}           // اختياري — Promise<Array>: كل الردود (GET /api/feedback)
 *   };
 *
 * شكل الرد اللي بيتبعت للسيرفر:
 *   { overall: 1-5, ease: 1-5|null, speed: 1-5|null, value: 1-5|null,
 *     problems: '', ideas: '', department: '', name: '' }
 */
(function () {
  'use strict';
  var CAMPAIGN = 'eval-2026-11';
  var SNOOZE_MS = 24 * 60 * 60 * 1000;
  var QUESTIONS = [
    { k: 'overall', t: 'التقييم العام للنظام', req: true },
    { k: 'ease', t: 'سهولة الاستخدام' },
    { k: 'speed', t: 'سرعة النظام وثباته' },
    { k: 'value', t: 'قد إيه سهّل شغلك مقارنة بالطريقة القديمة' }
  ];

  function cfg() { return window.MERSAL_FEEDBACK || {}; }
  function safe(fn, fb) { try { var v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function $(id) { return document.getElementById(id); }
  function key() {
    var c = cfg(); var u = typeof c.user === 'function' ? safe(c.user, '') : '';
    return 'mersal-feedback:' + CAMPAIGN + ':' + c.system + ':' + (u || 'anon');
  }
  function isReady() { var c = cfg(); return typeof c.ready !== 'function' || !!safe(c.ready, false); }
  function campaignOpen() { var c = cfg(); return !c.until || new Date() <= new Date(c.until + 'T23:59:59'); }

  var CSS =
    '.mfb-ov{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(10,30,28,.45);' +
    'font-family:Cairo,Tajawal,"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;direction:rtl;animation:mfb-f .2s ease-out;text-align:right}' +
    '.mfb-ov *{box-sizing:border-box;font-family:inherit}' +
    '.mfb-card{position:relative;width:100%;max-width:440px;max-height:calc(100vh - 28px);overflow:auto;background:#fff;color:#16302C;border-radius:20px;' +
    'box-shadow:0 24px 60px -12px rgba(0,0,0,.35);animation:mfb-u .25s ease-out}' +
    '.mfb-card.wide{max-width:960px}' +
    '.mfb-top{background:linear-gradient(135deg,#0B6B62,#13958A);padding:22px 22px 18px;color:#fff;position:relative;text-align:center}' +
    '.mfb-top:after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:#E6A82A}' +
    '.mfb-ic{width:52px;height:52px;margin:0 auto 8px;border-radius:50%;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;font-size:26px}' +
    '.mfb-top h2{margin:0;font-size:19px;line-height:1.5;font-weight:800;color:#fff}' +
    '.mfb-top p{margin:3px 0 0;font-size:13.5px;opacity:.92;color:#fff}' +
    '.mfb-x{position:absolute;top:10px;left:10px;width:32px;height:32px;border-radius:50%;border:0;background:rgba(255,255,255,.18);color:#fff;font-size:18px;line-height:32px;cursor:pointer;padding:0}' +
    '.mfb-body{padding:18px 20px 20px}' +
    '.mfb-body p{margin:0 0 6px;font-size:14.5px;line-height:1.8;color:#3b4f4b}' +
    '.mfb-c{text-align:center}' +
    '.mfb-bigstars{font-size:22px;letter-spacing:4px;color:#E6A82A;margin:2px 0 12px;text-align:center}' +
    '.mfb-btn{display:block;width:100%;border:0;border-radius:12px;padding:12px 16px;background:#0E7C72;color:#fff;font-size:16px;font-weight:700;cursor:pointer}' +
    '.mfb-btn:hover{background:#0B6B62}.mfb-btn:disabled{opacity:.6;cursor:default}' +
    '.mfb-btn:focus{outline:none}.mfb-btn:focus-visible{outline:3px solid #E6A82A;outline-offset:2px}' +
    '.mfb-link{display:block;width:100%;margin-top:6px;border:0;background:none;color:#6B7B77;font-size:14px;cursor:pointer;padding:8px}' +
    '.mfb-link:hover{color:#16302C}' +
    '.mfb-note{font-size:12px!important;color:#8a9a96!important;margin-top:8px!important;text-align:center}' +
    '.mfb-q{margin-bottom:12px}' +
    '.mfb-q label,.mfb-lbl{display:block;font-weight:700;font-size:14px;margin-bottom:4px;color:#16302C}' +
    '.mfb-req{color:#D64545}' +
    '.mfb-stars{display:flex;gap:4px;flex-direction:row}' +
    '.mfb-star{border:0;background:none;padding:0 2px;font-size:30px;line-height:1;color:#d9dfdd;cursor:pointer;transition:transform .1s}' +
    '.mfb-star.on{color:#E6A82A}.mfb-star:hover{transform:scale(1.12)}' +
    '.mfb-star:focus{outline:none}.mfb-star:focus-visible{outline:2px solid #0E7C72;border-radius:6px}' +
    '.mfb-in,.mfb-ta{width:100%;border:1px solid #d6e0dd;border-radius:10px;padding:9px 11px;font-size:14px;color:#16302C;background:#fff}' +
    '.mfb-ta{min-height:70px;resize:vertical}' +
    '.mfb-in:focus,.mfb-ta:focus{outline:none;border-color:#0E7C72;box-shadow:0 0 0 3px #E4F4F1}' +
    '.mfb-err{display:none;background:#FCE7E6;color:#B42318;border-radius:10px;padding:8px 12px;font-size:13.5px;margin-bottom:10px}' +
    '.mfb-fab{position:fixed;bottom:16px;left:16px;z-index:2147482000;border:0;border-radius:999px;padding:9px 14px;background:#0E7C72;color:#fff;' +
    'font:700 13px Cairo,Tajawal,"Segoe UI",Tahoma,sans-serif;box-shadow:0 6px 18px -6px rgba(0,0,0,.4);cursor:pointer;direction:rtl}' +
    '.mfb-fab:hover{background:#0B6B62}' +
    '.mfb-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}' +
    '.mfb-kpi{background:#F1F6F4;border-radius:12px;padding:10px 12px}' +
    '.mfb-kpi b{display:block;font-size:22px;color:#0E7C72;line-height:1.2}.mfb-kpi span{font-size:12.5px;color:#5d6f6b}' +
    '.mfb-dist{display:flex;flex-direction:column;gap:4px;margin-bottom:14px}' +
    '.mfb-dr{display:flex;align-items:center;gap:8px;font-size:13px}.mfb-dr i{display:block;height:10px;border-radius:5px;background:#E6A82A;min-width:2px}' +
    '.mfb-tw{overflow:auto;border:1px solid #e3e9e6;border-radius:12px}' +
    '.mfb-t{width:100%;border-collapse:collapse;font-size:13px}' +
    '.mfb-t th{background:#0E7C72;color:#fff;padding:8px 10px;text-align:right;white-space:nowrap;position:sticky;top:0}' +
    '.mfb-t td{padding:8px 10px;border-top:1px solid #e3e9e6;vertical-align:top;white-space:pre-wrap}' +
    '.mfb-t tr:nth-child(even) td{background:#f8fbfa}' +
    '.mfb-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.mfb-row .mfb-btn{width:auto;padding:9px 16px;font-size:14px}' +
    '@keyframes mfb-f{from{opacity:0}to{opacity:1}}@keyframes mfb-u{from{transform:translateY(14px);opacity:.6}to{transform:none;opacity:1}}' +
    '@media (prefers-reduced-motion:reduce){.mfb-ov,.mfb-card{animation:none}}' +
    '@media print{.mfb-fab{display:none}}';

  function ensureCss() {
    if ($('mfb-style')) return;
    var st = document.createElement('style'); st.id = 'mfb-style'; st.textContent = CSS; document.head.appendChild(st);
  }

  function modal(id, html, wide, onDismiss) {
    ensureCss();
    var old = $(id); if (old) old.parentNode.removeChild(old);
    var ov = document.createElement('div');
    ov.id = id; ov.className = 'mfb-ov';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="mfb-card' + (wide ? ' wide' : '') + '">' + html + '</div>';
    document.body.appendChild(ov);
    var dismiss = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); document.removeEventListener('keydown', onKey); if (onDismiss) onDismiss(); };
    function onKey(e) { if (e.key === 'Escape') dismiss(); }
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', function (e) { if (e.target === ov) dismiss(); });
    var x = ov.querySelector('.mfb-x'); if (x) x.onclick = dismiss;
    return { el: ov, close: function () { if (ov.parentNode) ov.parentNode.removeChild(ov); document.removeEventListener('keydown', onKey); } };
  }

  function header(title, sub, icon) {
    return '<div class="mfb-top"><button class="mfb-x" type="button" aria-label="إغلاق">×</button>' +
      '<div class="mfb-ic">' + (icon || '💬') + '</div><h2>' + esc(title) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>';
  }

  // ===== رسالة التقييم للموظف =====
  function snooze() { store(key(), 'snooze:' + (Date.now() + SNOOZE_MS)); }

  function showIntro() {
    var c = cfg();
    var m = modal('mfb-root',
      header('شاركنا رأيك في ' + (c.name || 'النظام'), 'رأيك هيفرق في تطوير النظام') +
      '<div class="mfb-body mfb-c"><div class="mfb-bigstars">★★★★★</div>' +
      '<p>قيّم تجربتك مع النظام، وقولنا إيه المشاكل اللي بتقابلك وإيه اللي نفسك يتضاف.</p>' +
      '<p><b>التقييم بياخد دقيقة واحدة.</b></p>' +
      '<button class="mfb-btn" type="button" id="mfb-start">قيّم الآن</button>' +
      '<button class="mfb-link" type="button" id="mfb-later">بعدين</button></div>',
      false, snooze);
    $('mfb-start').onclick = function () { m.close(); showForm(); };
    $('mfb-later').onclick = function () { m.close(); snooze(); };
    setTimeout(function () { var b = $('mfb-start'); if (b) b.focus(); }, 50);
  }

  function starsHtml(k) {
    var h = '<div class="mfb-stars" role="radiogroup" data-k="' + k + '">';
    for (var i = 1; i <= 5; i++) h += '<button type="button" class="mfb-star" role="radio" aria-checked="false" aria-label="' + i + ' من 5" data-v="' + i + '">★</button>';
    return h + '</div>';
  }

  function showForm() {
    var c = cfg();
    var vals = {};
    var qs = QUESTIONS.map(function (q) {
      return '<div class="mfb-q"><span class="mfb-lbl">' + esc(q.t) + (q.req ? ' <span class="mfb-req">*</span>' : '') + '</span>' + starsHtml(q.k) + '</div>';
    }).join('');
    var m = modal('mfb-root',
      header('تقييم ' + (c.name || 'النظام'), 'من 1 (ضعيف جدًا) لـ 5 (ممتاز)', '⭐') +
      '<form class="mfb-body" id="mfb-form" novalidate><div class="mfb-err" id="mfb-err"></div>' + qs +
      '<div class="mfb-q"><label for="mfb-problems">مشاكل أو أخطاء بتقابلك</label><textarea class="mfb-ta" id="mfb-problems" maxlength="2000"></textarea></div>' +
      '<div class="mfb-q"><label for="mfb-ideas">إضافات أو تعديلات تحب تشوفها</label><textarea class="mfb-ta" id="mfb-ideas" maxlength="2000"></textarea></div>' +
      '<div class="mfb-q"><label for="mfb-dept">الإدارة / القسم <span class="mfb-req">*</span></label><input class="mfb-in" id="mfb-dept" maxlength="120"></div>' +
      '<div class="mfb-q"><label for="mfb-name">الاسم (اختياري)</label><input class="mfb-in" id="mfb-name" maxlength="120"></div>' +
      '<button class="mfb-btn" type="submit" id="mfb-send">إرسال التقييم</button>' +
      '<p class="mfb-note">النتايج هتتعرض على الإدارة لتطوير الأنظمة.</p></form>',
      false, snooze);
    Array.prototype.forEach.call(m.el.querySelectorAll('.mfb-stars'), function (g) {
      var k = g.getAttribute('data-k');
      var paint = function (n) {
        Array.prototype.forEach.call(g.children, function (b, i) { b.classList.toggle('on', i < n); b.setAttribute('aria-checked', String(i + 1 === vals[k])); });
      };
      Array.prototype.forEach.call(g.children, function (b) {
        b.onclick = function () { vals[k] = Number(b.getAttribute('data-v')); paint(vals[k]); };
        b.onmouseenter = function () { paint(Number(b.getAttribute('data-v'))); };
      });
      g.onmouseleave = function () { paint(vals[k] || 0); };
    });
    $('mfb-form').onsubmit = function (e) {
      e.preventDefault();
      var err = $('mfb-err');
      var dept = $('mfb-dept').value.trim();
      if (!vals.overall) { err.textContent = 'من فضلك اختار التقييم العام (عدد النجوم).'; err.style.display = 'block'; return; }
      if (!dept) { err.textContent = 'من فضلك اكتب الإدارة أو القسم.'; err.style.display = 'block'; $('mfb-dept').focus(); return; }
      err.style.display = 'none';
      var data = {
        overall: vals.overall, ease: vals.ease || null, speed: vals.speed || null, value: vals.value || null,
        problems: $('mfb-problems').value.trim(), ideas: $('mfb-ideas').value.trim(),
        department: dept, name: $('mfb-name').value.trim()
      };
      var btn = $('mfb-send'); btn.disabled = true; btn.textContent = 'جاري الإرسال...';
      Promise.resolve().then(function () { return c.submit(data); }).then(function () {
        store(key(), 'done'); m.close(); showThanks();
      }, function (ex) {
        btn.disabled = false; btn.textContent = 'إرسال التقييم';
        err.textContent = (ex && ex.message) || 'حصلت مشكلة في الإرسال، جرّب تاني.'; err.style.display = 'block';
      });
    };
  }

  function showThanks() {
    var m = modal('mfb-root',
      header('شكرًا لرأيك 🙏', 'تقييمك اتسجل', '✅') +
      '<div class="mfb-body mfb-c"><p>هنراجع كل الملاحظات ونستخدمها في تطوير النظام.</p>' +
      '<button class="mfb-btn" type="button" id="mfb-ok">تمام</button></div>');
    $('mfb-ok').onclick = function () { m.close(); };
  }

  // ===== نتائج التقييم للأدمن =====
  function avg(rows, k) {
    var n = 0, s = 0; rows.forEach(function (r) { var v = Number(r[k]); if (v >= 1 && v <= 5) { n++; s += v; } });
    return n ? (Math.round((s / n) * 10) / 10).toFixed(1) : '—';
  }
  function fmtDate(d) { try { return new Date(d).toLocaleDateString('ar-EG'); } catch (e) { return ''; } }

  function toCsv(rows) {
    var head = ['التاريخ', 'الإدارة', 'الاسم', 'التقييم العام', 'سهولة الاستخدام', 'السرعة والثبات', 'تسهيل الشغل', 'مشاكل أو أخطاء', 'إضافات أو تعديلات'];
    var q = function (v) { v = v == null ? '' : String(v); return '"' + v.replace(/"/g, '""') + '"'; };
    var lines = [head.map(q).join(',')];
    rows.forEach(function (r) {
      lines.push([fmtDate(r.createdAt), r.department, r.name, r.overall, r.ease, r.speed, r.value, r.problems, r.ideas].map(q).join(','));
    });
    return '﻿' + lines.join('\r\n');
  }

  function showResults() {
    var c = cfg();
    var m = modal('mfb-results', header('نتائج تقييم ' + (c.name || 'النظام'), 'ردود الموظفين على رسالة التقييم', '📊') +
      '<div class="mfb-body" id="mfb-res"><p class="mfb-c">جاري التحميل...</p></div>', true);
    Promise.resolve().then(function () { return c.results(); }).then(function (rows) {
      rows = Array.isArray(rows) ? rows : [];
      var box = $('mfb-res'); if (!box) return;
      if (!rows.length) { box.innerHTML = '<p class="mfb-c">لسه مفيش ردود.</p>'; return; }
      var dist = [5, 4, 3, 2, 1].map(function (s) {
        var n = rows.filter(function (r) { return Number(r.overall) === s; }).length;
        return '<div class="mfb-dr"><span style="width:52px">' + s + ' ★</span><i style="width:' + Math.round(n / rows.length * 260) + 'px"></i><span>' + n + '</span></div>';
      }).join('');
      var trs = rows.map(function (r) {
        return '<tr><td>' + esc(fmtDate(r.createdAt)) + '</td><td>' + esc(r.department) + '</td><td>' + esc(r.name || '—') + '</td><td>' + esc(r.overall) +
          '</td><td>' + esc(r.ease || '—') + '</td><td>' + esc(r.speed || '—') + '</td><td>' + esc(r.value || '—') + '</td><td>' + esc(r.problems || '') + '</td><td>' + esc(r.ideas || '') + '</td></tr>';
      }).join('');
      box.innerHTML =
        '<div class="mfb-row"><button class="mfb-btn" type="button" id="mfb-csv">⬇ تحميل Excel</button></div>' +
        '<div class="mfb-kpis">' +
          '<div class="mfb-kpi"><b>' + rows.length + '</b><span>عدد الردود</span></div>' +
          '<div class="mfb-kpi"><b>' + avg(rows, 'overall') + '</b><span>التقييم العام (من 5)</span></div>' +
          '<div class="mfb-kpi"><b>' + avg(rows, 'ease') + '</b><span>سهولة الاستخدام</span></div>' +
          '<div class="mfb-kpi"><b>' + avg(rows, 'speed') + '</b><span>السرعة والثبات</span></div>' +
          '<div class="mfb-kpi"><b>' + avg(rows, 'value') + '</b><span>تسهيل الشغل</span></div>' +
        '</div>' +
        '<span class="mfb-lbl">توزيع التقييم العام</span><div class="mfb-dist">' + dist + '</div>' +
        '<span class="mfb-lbl">كل الردود</span><div class="mfb-tw"><table class="mfb-t"><thead><tr><th>التاريخ</th><th>الإدارة</th><th>الاسم</th><th>العام</th><th>السهولة</th><th>السرعة</th><th>الفائدة</th><th>مشاكل أو أخطاء</th><th>إضافات أو تعديلات</th></tr></thead><tbody>' + trs + '</tbody></table></div>';
      $('mfb-csv').onclick = function () {
        var blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'تقييم-' + (c.name || c.system) + '.csv'; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.parentNode.removeChild(a); }, 500);
      };
    }, function (ex) {
      var box = $('mfb-res'); if (box) box.innerHTML = '<p class="mfb-c">' + esc((ex && ex.message) || 'تعذّر تحميل النتايج.') + '</p>';
    });
  }

  function syncFab() {
    var c = cfg();
    var show = isReady() && typeof c.results === 'function' && typeof c.canViewResults === 'function' && !!safe(c.canViewResults, false);
    var fab = $('mfb-fab');
    if (show && !fab) {
      ensureCss();
      fab = document.createElement('button'); fab.id = 'mfb-fab'; fab.className = 'mfb-fab'; fab.type = 'button';
      fab.textContent = '📊 نتائج التقييم'; fab.onclick = showResults; document.body.appendChild(fab);
    } else if (!show && fab) { fab.parentNode.removeChild(fab); }
  }

  // ===== التشغيل =====
  var shown = false, checking = false;
  function tick() {
    syncFab();
    var c = cfg();
    if (shown || checking || !c.system || typeof c.submit !== 'function' || !campaignOpen() || !isReady()) return;
    if ($('mfb-root')) return;
    var v = store(key());
    if (v === 'done') return;
    if (v && v.indexOf('snooze:') === 0 && Date.now() < Number(v.slice(7))) return;
    if (typeof c.mine === 'function') {
      checking = true;
      Promise.resolve().then(function () { return c.mine(); }).then(function (done) {
        checking = false;
        if (done) { store(key(), 'done'); return; }
        if (!shown && isReady()) { shown = true; showIntro(); }
      }, function () { checking = false; if (!shown && isReady()) { shown = true; showIntro(); } });
    } else { shown = true; showIntro(); }
  }
  function start() { setTimeout(tick, 2500); setInterval(tick, 3000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
