/*
 * mersal-feedback.js — رسالة تقييم النظام (تظهر مرة واحدة لكل مستخدم)
 *
 * الاستخدام:
 *   window.MERSAL_FEEDBACK = {
 *     system:   'cases',                       // مفتاح النظام (لازم يكون ثابت)
 *     name:     'سيستم الحالات',               // اسم النظام اللي هيظهر في الرسالة
 *     formUrl:  'https://docs.google.com/...',  // لينك فورم التقييم (لو فاضي الرسالة مش هتظهر)
 *     ready:    function () { return true },    // اختياري: الرسالة تظهر بس لما ترجع true (مثلًا بعد تسجيل الدخول)
 *     user:     function () { return 'ahmed' }, // اختياري: اسم المستخدم، عشان الرسالة تظهر مرة لكل مستخدم على نفس الجهاز
 *     until:    '2026-11-24'                    // اختياري: بعد التاريخ ده الرسالة مش هتظهر خالص
 *   };
 *   <script src="/mersal-feedback.js" defer></script>
 *
 * "قيّم الآن" بيفتح الفورم في تاب جديد وما بتظهرش تاني.
 * "بعدين" بتأجلها لليوم اللي بعده.
 */
(function () {
  'use strict';
  var CAMPAIGN = 'eval-2026-11';
  var SNOOZE_MS = 24 * 60 * 60 * 1000;

  function cfg() { return window.MERSAL_FEEDBACK || {}; }
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }
  function key() {
    var c = cfg();
    var u = typeof c.user === 'function' ? safe(c.user, '') : '';
    return 'mersal-feedback:' + CAMPAIGN + ':' + c.system + ':' + (u || 'anon');
  }
  function shouldShow() {
    var c = cfg();
    if (!c.system || !c.formUrl) return false;
    if (c.until && new Date() > new Date(c.until + 'T23:59:59')) return false;
    if (typeof c.ready === 'function' && !safe(c.ready, false)) return false;
    if (document.getElementById('mfb-root')) return false;
    var v = store(key());
    if (v === 'done') return false;
    if (v && v.indexOf('snooze:') === 0 && Date.now() < Number(v.slice(7))) return false;
    return true;
  }

  var CSS =
    '#mfb-root{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;' +
    'background:rgba(10,30,28,.45);font-family:Cairo,Tajawal,"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;direction:rtl;animation:mfb-f .2s ease-out}' +
    '#mfb-root *{box-sizing:border-box}' +
    '#mfb-card{position:relative;width:100%;max-width:420px;background:#fff;color:#16302C;border-radius:20px;overflow:hidden;' +
    'box-shadow:0 24px 60px -12px rgba(0,0,0,.35);animation:mfb-u .25s ease-out;text-align:center}' +
    '#mfb-top{background:linear-gradient(135deg,#0B6B62,#13958A);padding:26px 22px 22px;color:#fff;position:relative}' +
    '#mfb-top:after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:#E6A82A}' +
    '#mfb-ic{width:58px;height:58px;margin:0 auto 10px;border-radius:50%;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;font-size:28px}' +
    '#mfb-top h2{margin:0;font-size:20px;line-height:1.5;font-weight:800;color:#fff}' +
    '#mfb-top p{margin:4px 0 0;font-size:13.5px;opacity:.9;color:#fff}' +
    '#mfb-body{padding:18px 22px 22px}' +
    '#mfb-body p{margin:0 0 6px;font-size:14.5px;line-height:1.8;color:#3b4f4b}' +
    '#mfb-stars{font-size:22px;letter-spacing:4px;color:#E6A82A;margin:4px 0 14px}' +
    '#mfb-go{display:block;width:100%;border:0;border-radius:12px;padding:12px 16px;background:#0E7C72;color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer}' +
    '#mfb-go:hover{background:#0B6B62}' +
    '#mfb-go:focus{outline:none}#mfb-go:focus-visible{outline:3px solid #E6A82A;outline-offset:2px}' +
    '#mfb-later{display:block;width:100%;margin-top:8px;border:0;background:none;color:#6B7B77;font:inherit;font-size:14px;cursor:pointer;padding:8px}' +
    '#mfb-later:hover{color:#16302C}' +
    '#mfb-x{position:absolute;top:10px;left:10px;width:32px;height:32px;border-radius:50%;border:0;background:rgba(255,255,255,.18);color:#fff;font-size:18px;line-height:32px;cursor:pointer;padding:0}' +
    '#mfb-note{font-size:12px!important;color:#8a9a96!important;margin-top:10px!important}' +
    '@keyframes mfb-f{from{opacity:0}to{opacity:1}}@keyframes mfb-u{from{transform:translateY(14px);opacity:.6}to{transform:none;opacity:1}}' +
    '@media (prefers-reduced-motion:reduce){#mfb-root,#mfb-card{animation:none}}';

  function close(state) {
    var r = document.getElementById('mfb-root');
    if (r) r.parentNode.removeChild(r);
    store(key(), state);
  }

  function show() {
    var c = cfg();
    if (!document.getElementById('mfb-style')) {
      var st = document.createElement('style'); st.id = 'mfb-style'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    var root = document.createElement('div');
    root.id = 'mfb-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'mfb-title');
    root.innerHTML =
      '<div id="mfb-card">' +
        '<div id="mfb-top">' +
          '<button id="mfb-x" type="button" aria-label="إغلاق">×</button>' +
          '<div id="mfb-ic">💬</div>' +
          '<h2 id="mfb-title">شاركنا رأيك في ' + esc(c.name || 'النظام') + '</h2>' +
          '<p>رأيك هيفرق في تطوير النظام</p>' +
        '</div>' +
        '<div id="mfb-body">' +
          '<div id="mfb-stars">★★★★★</div>' +
          '<p>قيّم تجربتك مع النظام، وقولنا إيه المشاكل اللي بتقابلك وإيه اللي نفسك يتضاف.</p>' +
          '<p><b>التقييم بياخد حوالي 3 دقايق.</b></p>' +
          '<button id="mfb-go" type="button">قيّم الآن</button>' +
          '<button id="mfb-later" type="button">بعدين</button>' +
          '<p id="mfb-note">الاسم اختياري، والنتايج هتتعرض على الإدارة لتطوير الأنظمة.</p>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);
    var later = function () { close('snooze:' + (Date.now() + SNOOZE_MS)); };
    document.getElementById('mfb-go').onclick = function () { window.open(c.formUrl, '_blank', 'noopener'); close('done'); };
    document.getElementById('mfb-later').onclick = later;
    document.getElementById('mfb-x').onclick = later;
    root.addEventListener('click', function (e) { if (e.target === root) later(); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' && document.getElementById('mfb-root')) { later(); document.removeEventListener('keydown', onKey); }
    });
    setTimeout(function () { var b = document.getElementById('mfb-go'); if (b) b.focus(); }, 50);
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) { return '&#' + ch.charCodeAt(0) + ';'; }); }

  // بنستنى شوية بعد ما الصفحة تفتح، وبنفضل نشيك كل 3 ثواني (لحد ما المستخدم يسجل دخول مثلًا)
  var shownOnce = false;
  function tick() {
    if (shownOnce) return;
    if (shouldShow()) { shownOnce = true; show(); }
  }
  function start() { setTimeout(tick, 2500); setInterval(tick, 3000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
