"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// شريط تحميل رفيع فوق الصفحة بيظهر مع أي تنقل، وزرار رجوع لأعلى الصفحة
export function RouteProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  // الصفحة الجديدة وصلت
  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    const t = setTimeout(() => setState("idle"), 400);
    return () => clearTimeout(t);
  }, [pathname, search]);

  useEffect(() => {
    let safety: ReturnType<typeof setTimeout>;
    const begin = () => { setState("loading"); clearTimeout(safety); safety = setTimeout(() => setState("idle"), 10_000); };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      begin();
    };
    const onSubmit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement | null;
      if (f && (f.method || "get").toLowerCase() === "get" && !e.defaultPrevented) begin();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("submit", onSubmit); clearTimeout(safety); };
  }, []);

  if (state === "idle") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] no-print" role="progressbar" aria-label="جاري التحميل">
      <div className={`h-full origin-right rounded-l-full bg-gradient-to-l from-brand-400 via-brand-500 to-accent-400 shadow-[0_0_10px_rgba(20,184,166,0.6)] ${state === "loading" ? "animate-route-load" : "animate-route-done"}`} />
    </div>
  );
}

export function ScrollTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button type="button" aria-label="أعلى الصفحة" title="أعلى الصفحة" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="animate-toast-in fixed bottom-24 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:text-brand-700 lg:bottom-6 no-print">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
    </button>
  );
}
