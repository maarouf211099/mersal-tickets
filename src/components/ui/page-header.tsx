// عنوان موحّد لكل الصفحات: أيقونة + عنوان + وصف + أزرار
export function PageHeader({ icon, title, subtitle, children }: {
  icon: string; title: string; subtitle?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="animate-pop-in flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-slate-200" aria-hidden>{icon}</span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
