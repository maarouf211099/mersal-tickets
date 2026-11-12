"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { quickSearch } from "@/actions/search";

type Hit = Awaited<ReturnType<typeof quickSearch>>[number];
const TYPE_DOT: Record<string, string> = { emergency: "bg-red-500", new_case: "bg-violet-500", follow_up: "bg-brand-500" };

export function openQuickSearch() {
  window.dispatchEvent(new Event("quick-search:open"));
}

// بحث سريع من أي صفحة: Ctrl+K أو / — نتايج فورية، والأسهم للتنقل، و Enter للفتح
export function QuickSearch({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);

  const links = [
    ...(canCreate ? [{ label: "تذكرة جديدة", icon: "➕", href: "/tickets/new" }] : []),
    { label: "التذاكر المتأخرة", icon: "⏰", href: "/tickets?status=pending&sla=breached" },
    { label: "المسندة إليّ", icon: "👤", href: "/tickets?status=pending&mine=1" },
    { label: "تذاكر اليوم", icon: "📅", href: "/tickets?period=today&sort=created&dir=desc" },
    { label: "الإشعارات", icon: "🔔", href: "/notifications" },
  ];
  const term = q.trim();
  const rows = term.length >= 2
    ? [...hits.map((h) => ({ key: h.id, href: `/tickets/${h.id}`, hit: h })), { key: "all", href: `/tickets?q=${encodeURIComponent(term)}`, hit: null }]
    : links.map((l) => ({ key: l.href, href: l.href, hit: null, link: l }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "") || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) { e.preventDefault(); setOpen(true); }
      else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("quick-search:open", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("quick-search:open", onOpen); };
  }, []);

  useEffect(() => {
    if (open) { setQ(""); setHits([]); setSel(0); requestAnimationFrame(() => input.current?.focus()); }
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // بحث بعد ما المستخدم يوقف كتابة ربع ثانية
  useEffect(() => {
    if (term.length < 2) { setHits([]); setBusy(false); return; }
    setBusy(true);
    let stale = false;
    const t = setTimeout(async () => {
      try { const r = await quickSearch(term); if (!stale) { setHits(r); setSel(0); } }
      catch { if (!stale) setHits([]); }
      finally { if (!stale) setBusy(false); }
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [term]);

  const go = (href: string) => { setOpen(false); router.push(href); };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh] no-print" role="dialog" aria-modal="true" aria-label="بحث سريع">
      <div className="animate-fade absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="animate-pop-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(rows.length - 1, s + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === "Enter" && rows[sel]) { e.preventDefault(); go(rows[sel].href); }
            }}
            placeholder="ابحث بالاسم، رقم التذكرة، الهاتف، الكود…"
            className="h-14 w-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none" />
          {busy && <span className="h-4 w-4 shrink-0 animate-spin-fast rounded-full border-2 border-brand-500 border-t-transparent" />}
          <kbd className="hidden shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500 sm:block">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {term.length < 2 && <li className="px-3 pb-1 pt-2 text-xs font-medium text-slate-400">اختصارات</li>}
          {rows.map((r, i) => (
            <li key={r.key}>
              <button type="button" onMouseEnter={() => setSel(i)} onClick={() => go(r.href)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm transition-colors ${i === sel ? "bg-brand-50 text-brand-900" : "text-slate-700"}`}>
                {r.hit ? (
                  <>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TYPE_DOT[r.hit.type]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.hit.beneficiaryName}</span>
                      <span className="block font-mono text-xs text-slate-400" dir="ltr" style={{ textAlign: "right" }}>{r.hit.ticketNumber} · {r.hit.phone1}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${r.hit.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}`}>
                      {r.hit.status === "pending" ? "قيد التنفيذ" : "مغلقة"}
                    </span>
                  </>
                ) : "link" in r && r.link ? (
                  <><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">{r.link.icon}</span><span className="font-medium">{r.link.label}</span></>
                ) : (
                  <><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">🔎</span>
                    <span>{busy ? "جاري البحث…" : hits.length ? `عرض كل النتائج لـ «${term}»` : `لا توجد نتائج سريعة — ابحث في كل التذاكر عن «${term}»`}</span></>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500 sm:flex">
          <span><kbd className="rounded border border-slate-200 bg-white px-1">↑</kbd> <kbd className="rounded border border-slate-200 bg-white px-1">↓</kbd> للتنقل</span>
          <span><kbd className="rounded border border-slate-200 bg-white px-1">Enter</kbd> للفتح</span>
          <span className="mr-auto"><kbd className="rounded border border-slate-200 bg-white px-1">Ctrl</kbd> + <kbd className="rounded border border-slate-200 bg-white px-1">K</kbd> من أي صفحة</span>
        </div>
      </div>
    </div>
  );
}
