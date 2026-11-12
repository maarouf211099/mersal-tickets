"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/actions/auth";
import { cn, displayName } from "@/lib/utils";
import { Logo } from "./logo";
import { QuickSearch, openQuickSearch } from "./quick-search";

type NavUser = { name: string; role: string; teams: string[] };

export function Nav({ user, initialUnread }: { user: NavUser; initialUnread: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);
  const [toast, setToast] = useState<{ title: string; body?: string; ticketId?: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ctx = () => new (window.AudioContext || (window as any).webkitAudioContext)();
    (window as any).__playSound = (type: "default" | "emergency" = "default") => {
      try {
        const audioCtx = ctx();
        const beeps = type === "emergency" ? 3 : 1;
        const freq = type === "emergency" ? 880 : 660;
        for (let i = 0; i < beeps; i++) {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain); gain.connect(audioCtx.destination);
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.001, audioCtx.currentTime + i * 0.25);
          gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + i * 0.25 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.25 + 0.18);
          osc.start(audioCtx.currentTime + i * 0.25);
          osc.stop(audioCtx.currentTime + i * 0.25 + 0.2);
        }
      } catch {}
    };
  }, []);

  // إشعارات: سؤال خفيف كل 20 ثانية (بيكمل يشتغل عادي بعد أي restart للسيرفر)
  useEffect(() => {
    let since = new Date().toISOString();
    let stopped = false;
    async function poll() {
      try {
        const res = await fetch(`/api/notifications?since=${encodeURIComponent(since)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        since = data.now;
        setUnread(data.unread);
        if (data.fresh?.length) {
          const first = data.fresh[0];
          setToast({ title: first.title, body: first.body ?? undefined, ticketId: first.ticketId ?? undefined });
          setTimeout(() => setToast(null), 6000);
          const urgent = data.fresh.some((n: { type: string }) => n.type === "emergency" || n.type === "sla_breached");
          (window as any).__playSound?.(urgent ? "emergency" : "default");
          if ("Notification" in window && Notification.permission === "granted") {
            for (const n of data.fresh) new Notification(n.title, { body: n.body ?? "" });
          }
          router.refresh();
        }
      } catch {}
    }
    const t = setInterval(() => { if (!stopped) poll(); }, 20_000);
    return () => { stopped = true; clearInterval(t); };
  }, [router]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // مجموعات التنقل - كل مجموعة بينها فاصل
  const primaryNav = [
    { href: "/dashboard", label: "الرئيسية", icon: HomeIcon },
    { href: "/tickets",   label: "التذاكر",  icon: TicketIcon },
    { href: "/approvals", label: "الموافقات", icon: DocIcon },
  ];
  const utilityNav = [
    { href: "/notifications", label: "الإشعارات", icon: BellIcon, badge: unread },
  ];
  const adminNav = user.role === "manager" ? [
    { href: "/admin/teams", label: "الفرق", icon: UsersIcon },
    { href: "/admin/users", label: "المستخدمون", icon: UserIcon },
    { href: "/admin/reports", label: "التقارير", icon: ChartIcon },
    { href: "/admin/audit", label: "السجل", icon: LogIcon },
    { href: "/admin/settings", label: "الإعدادات", icon: GearIcon },
  ] : [];
  const roleAr = user.role === "manager" ? "المدير" : user.role === "supervisor" ? "المشرف" : user.role === "agent" ? "الموظف" : "المشاهد";

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <>
      {/* القائمة الجانبية — الشاشات الكبيرة */}
      <aside className="fixed inset-y-0 right-0 z-50 hidden w-64 flex-col overflow-hidden bg-gradient-to-b from-brand-900 via-[#0f5f59] to-brand-900 text-white shadow-2xl shadow-brand-900/30 xl:flex no-print">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 animate-float rounded-full bg-white/5" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 animate-float-slow rounded-full bg-accent-400/10" />
        <Link href="/dashboard" className="group relative flex items-center gap-3 px-5 pb-4 pt-5">
          <span className="transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105"><Logo size={44} showText={false} /></span>
          <span>
            <span className="block text-2xl font-extrabold leading-tight text-accent-400">مرسال</span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.28em] text-brand-200">نظام التذاكر</span>
          </span>
        </Link>
        {user.role !== "viewer" && (
          <div className="relative px-4 pb-3">
            <Link href="/tickets/new" className="group flex items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold text-brand-800 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-accent-50 active:scale-[0.98]">
              <PlusIcon className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" /> تذكرة جديدة
            </Link>
          </div>
        )}
        <div className="relative flex-1 overflow-y-auto px-3 pb-3 [scrollbar-width:thin]">
          <SideLabel>القائمة</SideLabel>
          {[...primaryNav, ...utilityNav].map((it) => <SideLink key={it.href} {...it} active={isActive(it.href)} />)}
          {adminNav.length > 0 && (
            <>
              <SideLabel>الإدارة</SideLabel>
              {adminNav.map((it) => <SideLink key={it.href} {...it} active={isActive(it.href)} />)}
            </>
          )}
        </div>
        <div className="relative border-t border-white/10 p-3">
          <Link href="/account" className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/10">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-sm font-bold text-white ring-2 ring-white/30">
              {user.name.charAt(0)}
              <span className="absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-brand-900" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{user.name}</span>
              <span className="block truncate text-[11px] text-brand-200">{roleAr}{user.teams.length > 0 && ` · ${user.teams.join("، ")}`}</span>
            </span>
          </Link>
          <button onClick={() => logout()} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-brand-100/80 transition hover:bg-white/10 hover:text-white">
            <LogoutIcon className="h-4 w-4" /> تسجيل الخروج
          </button>
        </div>
      </aside>

      <nav className={cn("sticky top-0 z-40 border-b backdrop-blur-md transition-all duration-300 xl:mr-64",
        scrolled ? "border-slate-200 bg-white/85 shadow-md shadow-slate-900/5" : "border-slate-200/80 bg-white/95 shadow-sm")}>
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 sm:px-6 h-16">
          {/* Logo */}
          <Link href="/dashboard" className="shrink-0 group xl:hidden">
            <div className="transition-transform duration-200 group-hover:scale-105">
              <Logo />
            </div>
          </Link>

          {/* Primary Navigation */}
          <div className="hidden lg:flex xl:hidden items-center gap-1 mr-2">
            {primaryNav.map((it) => (
              <NavLink key={it.href} {...it} active={isActive(it.href)} />
            ))}
          </div>

          {/* Divider */}
          <div className="hidden lg:block xl:hidden h-6 w-px bg-slate-200" />

          {/* Utility Navigation */}
          <div className="hidden lg:flex xl:hidden items-center gap-1">
            {utilityNav.map((it) => (
              <NavLink key={it.href} {...it} active={isActive(it.href)} />
            ))}
          </div>

          {/* Admin Section */}
          {adminNav.length > 0 && (
            <>
              <div className="hidden lg:block xl:hidden h-6 w-px bg-slate-200" />
              <div className="hidden lg:flex xl:hidden items-center gap-1">
                {adminNav.map((it) => (
                  <NavLink key={it.href} {...it} active={isActive(it.href)} />
                ))}
              </div>
            </>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Quick Action Buttons - "جديد" */}
          <div className="hidden xl:flex items-center gap-2">
            {user.role !== "viewer" && <QuickAdd href="/tickets/new" label="تذكرة" color="teal" />}
            <QuickAdd href="/approvals/new" label="موافقة" color="gold" />
          </div>

          {/* Search — بيفتح البحث السريع (Ctrl+K) */}
          <button type="button" onClick={openQuickSearch} title="بحث (Ctrl+K)" aria-label="بحث"
            className="group flex h-9 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50/70 px-2.5 text-sm text-slate-400 transition-all hover:border-brand-300 hover:bg-white hover:text-brand-700 hover:shadow-sm xl:order-first xl:h-10 xl:w-80 xl:px-4">
            <SearchIcon className="h-4 w-4 shrink-0" />
            <span className="hidden flex-1 truncate text-right xl:block">ابحث بالاسم أو رقم التذكرة…</span>
            <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-400 xl:block">Ctrl K</kbd>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-full p-1 pl-3 transition-all hover:bg-slate-100"
            >
              <span className="hidden sm:block text-sm font-medium text-slate-700">
                {displayName(user.name)}
              </span>
              <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm ring-2 ring-white transition-transform hover:scale-105">
                {user.name.charAt(0)}
                <span className="absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </span>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 top-12 z-50 w-56 origin-top-left animate-fade-in-up rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {user.role === "manager" ? "المدير" : user.role === "supervisor" ? "المشرف" : user.role === "agent" ? "الموظف" : "المشاهد"}
                      {user.teams.length > 0 && <> — {user.teams.join("، ")}</>}
                    </div>
                  </div>
                  {/* على الشاشات الصغيرة: روابط التنقل داخل القائمة */}
                  <div className="border-b border-slate-100 py-1 lg:hidden">
                    {[...primaryNav, ...utilityNav, ...adminNav].map((it) => (
                      <Link key={it.href} href={it.href} onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                        <it.icon className="h-4 w-4 text-slate-400" />{it.label}
                      </Link>
                    ))}
                    {user.role !== "viewer" && (
                      <Link href="/tickets/new" onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                        <PlusIcon className="h-4 w-4" />تذكرة جديدة
                      </Link>
                    )}
                  </div>
                  <Link
                    href="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    <UserIcon className="h-4 w-4 text-slate-400" />
                    الحساب
                  </Link>
                  <button
                    onClick={() => logout()}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                  >
                    <LogoutIcon className="h-4 w-4" />
                    تسجيل الخروج
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <QuickSearch canCreate={user.role !== "viewer"} />

      {/* شريط التنقل السفلي — الموبايل والتابلت */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden no-print pb-safe">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5">
          <TabLink href="/dashboard" label="الرئيسية" icon={HomeIcon} active={isActive("/dashboard")} />
          <TabLink href="/tickets" label="التذاكر" icon={TicketIcon} active={isActive("/tickets") && pathname !== "/tickets/new"} />
          {user.role !== "viewer" ? (
            <Link href="/tickets/new" aria-label="تذكرة جديدة" className="-mt-6 flex flex-col items-center gap-0.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30 ring-4 ring-white transition active:scale-95">
                <PlusIcon className="h-6 w-6" />
              </span>
              <span className="text-[10px] font-medium text-slate-500">جديدة</span>
            </Link>
          ) : <span />}
          <TabLink href="/notifications" label="الإشعارات" icon={BellIcon} active={isActive("/notifications")} badge={unread} />
          <button type="button" onClick={openQuickSearch} className="flex flex-col items-center gap-0.5 py-1 text-slate-500">
            <SearchIcon className="h-5 w-5" /><span className="text-[10px] font-medium">بحث</span>
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-4 z-50 max-w-sm animate-slide-in rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <BellIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900">{toast.title}</div>
              {toast.body && <div className="mt-0.5 text-xs text-slate-600 line-clamp-2">{toast.body}</div>}
              {toast.ticketId && (
                <Link href={`/tickets/${toast.ticketId}`}
                  className="mt-2 inline-block text-xs font-semibold text-brand-600 hover:underline"
                  onClick={() => setToast(null)}>
                  فتح التذكرة ←
                </Link>
              )}
            </div>
            <button onClick={() => setToast(null)} className="shrink-0 text-slate-400 hover:text-slate-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ────────────────────────────────────────────────
// مكوّن رابط الـ Nav — مع hover animation
// ────────────────────────────────────────────────
function NavLink({ href, label, icon: Icon, active, badge }: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={cn(
        "group relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <Icon className={cn("h-4 w-4 transition-transform duration-200", active ? "" : "group-hover:scale-110")} />
      {/* على الشاشات المتوسطة الأيقونة بس — الاسم بيظهر في التلميح */}
      <span className="hidden xl:inline">{label}</span>
      {typeof badge === "number" && badge > 0 && (
        <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white animate-pulse-scale">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {/* underline animation */}
      {!active && (
        <span className="absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 bg-brand-500 transition-all duration-200 group-hover:w-8 rounded-full" />
      )}
      {active && (
        <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 bg-brand-600 rounded-full" />
      )}
    </Link>
  );
}

function SideLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-200/70">{children}</div>;
}

function SideLink({ href, label, icon: Icon, active, badge }: {
  href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean; badge?: number;
}) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cn("group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
        active ? "bg-white/15 text-white shadow-inner shadow-black/10" : "text-brand-100/85 hover:bg-white/10 hover:pr-4 hover:text-white")}>
      {active && <span className="absolute right-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-l-full bg-accent-400" />}
      <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform duration-200", active ? "text-accent-300" : "group-hover:scale-110")} />
      <span className="flex-1">{label}</span>
      {typeof badge === "number" && badge > 0 && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white animate-pulse-scale">{badge > 99 ? "99+" : badge}</span>
      )}
    </Link>
  );
}

function TabLink({ href, label, icon: Icon, active, badge }: {
  href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean; badge?: number;
}) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cn("relative flex flex-col items-center gap-0.5 py-1 transition-colors", active ? "text-brand-700" : "text-slate-500")}>
      <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-brand-50")}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[10px] font-medium">{label}</span>
      {typeof badge === "number" && badge > 0 && (
        <span className="absolute right-1/2 top-0 -mr-5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{badge > 99 ? "99+" : badge}</span>
      )}
    </Link>
  );
}

// ────────────────────────────────────────────────
// أزرار الإضافة السريعة — "تذكرة جديدة" و"موافقة جديدة"
// ────────────────────────────────────────────────
function QuickAdd({ href, label, color }: { href: string; label: string; color: "teal" | "gold" }) {
  const styles = color === "teal"
    ? "bg-brand-50 text-brand-700 hover:bg-brand-600 hover:text-white ring-1 ring-brand-200 hover:ring-brand-600"
    : "bg-accent-50 text-accent-700 hover:bg-accent-500 hover:text-white ring-1 ring-accent-200 hover:ring-accent-500";
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
        styles
      )}
    >
      <PlusIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-90" />
      {label}
    </Link>
  );
}

// ────────────────────────────────────────────────
// الأيقونات — SVG inline خفيفة الوزن
// ────────────────────────────────────────────────
function HomeIcon(p: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function TicketIcon(p: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 17v2M13 11v2"/></svg>;
}
function DocIcon(p: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>;
}
function BellIcon(p: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
}
function UsersIcon(p: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function ChartIcon(p: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}
function GearIcon(p: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}
function LogIcon(p: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>;
}
function UserIcon(p: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
function LogoutIcon(p: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
}
function SearchIcon(p: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function PlusIcon(p: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
