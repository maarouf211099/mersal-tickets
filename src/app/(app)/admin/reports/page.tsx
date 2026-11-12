import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { buildReport, resolveRange } from "@/lib/reports";
import { PageHeader } from "@/components/ui/page-header";
import { CountUp } from "@/components/ui/count-up";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/form";
import { PrintButton } from "./print";

export const dynamic = "force-dynamic";

const PRESETS = [["today", "اليوم"], ["7d", "7 أيام"], ["30d", "30 يومًا"], ["month", "هذا الشهر"], ["all", "الكل"]];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ preset?: string; from?: string; to?: string }> }) {
  const s = await auth();
  if (!s) redirect("/login");
  if (s.user.role !== "manager") redirect("/dashboard");
  const q = await searchParams;
  const range = resolveRange(q);
  const rep = await buildReport(range);
  const { kpi } = rep;
  const custom = !!(q.from && q.to);
  const preset = custom ? "" : (q.preset ?? "30d");
  const qs = new URLSearchParams(custom ? { from: range.fromYmd, to: range.toYmd } : { preset }).toString();
  const exp = (kind: string) => `/api/export/report?kind=${kind}&${qs}`;
  const maxDay = Math.max(1, ...rep.days.map((d) => Math.max(d.created, d.closed)));
  const maxSrc = Math.max(1, ...rep.bySource.map((x) => x.count));
  const maxCat = Math.max(1, ...rep.byCloseCategory.map((x) => x.count));
  const pct = (v: number | null) => (v == null ? "—" : `${v}%`);
  const hrs = (v: number | null) => (v == null ? "—" : v >= 48 ? `${Math.round(v / 24)} يوم` : `${v} س`);
  const slaTone = (v: number | null) => (v == null ? "text-slate-400" : v >= 85 ? "text-emerald-600" : v >= 60 ? "text-amber-600" : "text-red-600");

  return (
    <div className="space-y-5">
      <PageHeader icon="📊" title="التقارير" subtitle={`الفترة: ${range.label}`}>
        <PrintButton />
      </PageHeader>

      <div className="card flex flex-wrap items-center gap-3 p-4 no-print">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(([k, label]) => (
            <Link key={k} href={`/admin/reports?preset=${k}`}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${preset === k ? "bg-brand-600 text-white shadow-md shadow-brand-600/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</Link>
          ))}
        </div>
        <form method="get" className="mr-auto flex flex-wrap items-center gap-2 text-sm text-slate-600">
          من <Input type="date" name="from" dir="ltr" defaultValue={custom ? range.fromYmd : ""} required className="w-40" />
          إلى <Input type="date" name="to" dir="ltr" defaultValue={custom ? range.toYmd : ""} required className="w-40" />
          <button className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-900">عرض</button>
        </form>
      </div>

      {/* أرقام عامة */}
      <div className="stagger grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi icon="🎫" label="تذاكر جديدة في الفترة" value={kpi.created} tone="brand" />
        <Kpi icon="✅" label="أُغلقت في الفترة" value={kpi.closed} tone="emerald" />
        <Kpi icon="⏱" label="الالتزام بمهلة الإنجاز" text={pct(kpi.slaPct)} tone={kpi.slaPct == null ? "slate" : kpi.slaPct >= 85 ? "emerald" : kpi.slaPct >= 60 ? "amber" : "red"} hint="من التذاكر المغلقة في الفترة" />
        <Kpi icon="⌛" label="متوسط زمن الإغلاق" text={hrs(kpi.avgCloseHours)} tone="violet" hint="من الإنشاء حتى الإغلاق" />
        <Kpi icon="📂" label="مفتوحة الآن" value={kpi.openNow} tone="sky" href="/tickets?status=pending" />
        <Kpi icon="⛔" label="متأخرة الآن" value={kpi.breachedNow} tone={kpi.breachedNow ? "red" : "slate"} href="/tickets?status=pending&sla=breached" />
        <Kpi icon="📥" label="لم تُستلم بعد" value={kpi.unreceivedNow} tone={kpi.unreceivedNow ? "amber" : "slate"} />
        <Kpi icon="🚑" label="طلبات إسعاف في الفترة" value={kpi.ambulance} tone="rose" />
      </div>

      {/* يوم بيوم */}
      <section className="card p-5">
        <Head title="📈 التذاكر يومًا بيوم" href={exp("days")}>
          <span className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> جديدة</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> مغلقة</span>
          </span>
        </Head>
        <div className="overflow-x-auto pb-1">
          <div className="flex h-48 items-end gap-1" style={{ minWidth: rep.days.length * 18 }}>
            {rep.days.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 items-end justify-center gap-[2px]" title={`${d.day} — جديدة ${d.created} · مغلقة ${d.closed}`}>
                <div className="bar-rise w-1/2 max-w-[14px] rounded-t bg-brand-500 transition-colors group-hover:bg-brand-600" style={{ height: `${(d.created / maxDay) * 100}%`, minHeight: d.created ? 3 : 0 }} />
                <div className="bar-rise w-1/2 max-w-[14px] rounded-t bg-slate-300 transition-colors group-hover:bg-slate-400" style={{ height: `${(d.closed / maxDay) * 100}%`, minHeight: d.closed ? 3 : 0 }} />
                <div className="pointer-events-none absolute -top-1 z-10 hidden -translate-y-full whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-[11px] text-white shadow-lg group-hover:block">
                  {d.day.slice(5)} · {d.created} جديدة · {d.closed} مغلقة
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400" dir="ltr" style={{ minWidth: rep.days.length * 18 }}>
            <span>{rep.days.at(-1)?.day}</span><span>{rep.days[0]?.day}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="card p-5">
          <Head title="🗂 بالنوع" href={exp("types")} />
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500"><th className="pb-2 text-right font-medium">النوع</th><th className="pb-2 font-medium">جديدة</th><th className="pb-2 font-medium">مغلقة</th><th className="pb-2 font-medium">الالتزام</th><th className="pb-2 font-medium">متوسط</th></tr></thead>
            <tbody>
              {rep.byType.map((t) => (
                <tr key={t.key} className="border-t border-slate-100 text-center">
                  <td className="py-2.5 text-right font-medium text-slate-800">{t.label}</td>
                  <td className="font-semibold">{t.created}</td><td>{t.closed}</td>
                  <td className={`font-semibold ${slaTone(t.slaPct)}`}>{pct(t.slaPct)}</td><td className="text-slate-500">{hrs(t.avgCloseHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card p-5">
          <Head title="📞 بمصدر الحالة" />
          <Bars rows={rep.bySource} max={maxSrc} color="bg-sky-500" />
        </section>
        <section className="card p-5">
          <Head title="🔒 بسبب الإغلاق" />
          {rep.byCloseCategory.length ? <Bars rows={rep.byCloseCategory} max={maxCat} color="bg-violet-500" /> : <Empty />}
        </section>
      </div>

      {/* بالفريق */}
      <section className="card p-5">
        <Head title="👥 أداء الفرق" href={exp("teams")} />
        <div className="overflow-x-auto">
          <table className="data-table min-w-[760px]">
            <thead><tr><th>الفريق</th><th>الأعضاء</th><th>مفتوحة الآن</th><th>متأخرة الآن</th><th>لم تُستلم</th><th>أُغلقت في الفترة</th><th>الالتزام بالمهلة</th><th>متوسط الإغلاق</th></tr></thead>
            <tbody>
              {rep.byTeam.map((t) => (
                <tr key={t.id}>
                  <td><Link href={`/tickets?status=pending&teamId=${t.id}`} className="inline-flex items-center gap-2 font-medium text-slate-800 hover:text-brand-700"><span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />{t.name}</Link></td>
                  <td className="text-slate-500">{t.members}</td>
                  <td className="font-semibold">{t.open}</td>
                  <td className={t.breached ? "font-semibold text-red-600" : "text-slate-400"}>{t.breached}</td>
                  <td className={t.unreceived ? "font-semibold text-amber-600" : "text-slate-400"}>{t.unreceived}</td>
                  <td>{t.closed}</td>
                  <td className={`font-semibold ${slaTone(t.slaPct)}`}>{pct(t.slaPct)}</td>
                  <td className="text-slate-500">{hrs(t.avgCloseHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* بالموظف */}
      <section className="card p-5">
        <Head title="🧑‍💼 نشاط الموظفين في الفترة" href={exp("users")}>
          <span className="text-xs text-slate-500">{rep.byUser.length} موظف نشط · {rep.idleUsers} بدون أي نشاط</span>
        </Head>
        {rep.byUser.length === 0 ? <Empty /> : (
          <div className="max-h-[520px] overflow-auto">
            <table className="data-table min-w-[760px]">
              <thead className="sticky top-0 z-10"><tr><th>#</th><th>الموظف</th><th>الفرق</th><th>أنشأ</th><th>استلم</th><th>حوّل</th><th>تحديثات</th><th>أغلق</th><th>الإجمالي</th></tr></thead>
              <tbody>
                {rep.byUser.map((u, i) => (
                  <tr key={u.id}>
                    <td className="text-xs text-slate-400">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td>
                    <td><span className="inline-flex items-center gap-2 font-medium text-slate-800"><Avatar name={u.name} size="xs" />{u.name}</span></td>
                    <td className="text-xs text-slate-500">{u.teams || "—"}</td>
                    <td>{u.created}</td><td>{u.received}</td><td>{u.transfers}</td><td>{u.comments}</td><td>{u.closed}</td>
                    <td className="font-bold text-brand-700">{u.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi icon="🔑" label="مرات تسجيل الدخول" value={kpi.logins} tone="slate" />
        <Kpi icon="🚫" label="محاولات دخول فاشلة" value={kpi.failedLogins} tone={kpi.failedLogins > 20 ? "red" : "slate"} href="/admin/audit?source=system" />
        <Kpi icon="🙋" label="مفتوحة بدون مسؤول" value={kpi.unassignedNow} tone={kpi.unassignedNow ? "amber" : "slate"} />
        <a href={`/api/export/tickets?status=all${preset && preset !== "all" && preset !== "month" ? `&period=${preset}` : ""}`} className="card card-hover flex items-center justify-center gap-2 p-4 text-sm font-semibold text-brand-700 no-print">⬇️ تصدير كل التذاكر (Excel)</a>
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  brand: "bg-brand-50 text-brand-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700", sky: "bg-sky-50 text-sky-700", rose: "bg-rose-50 text-rose-700", slate: "bg-slate-100 text-slate-600",
};

function Kpi({ icon, label, value, text, tone, hint, href }: { icon: string; label: string; value?: number; text?: string; tone: string; hint?: string; href?: string }) {
  const body = (
    <>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl transition-transform duration-300 group-hover:scale-110 ${TONES[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <div className={`text-2xl font-bold leading-tight ${tone === "red" ? "text-red-600" : "text-slate-900"}`}>{text ?? <CountUp value={value ?? 0} />}</div>
        <div className="truncate text-xs text-slate-500" title={hint ?? label}>{label}</div>
      </div>
    </>
  );
  return href
    ? <Link href={href} className="card card-hover group flex items-center gap-4 p-4">{body}</Link>
    : <div className="card group flex items-center gap-4 p-4">{body}</div>;
}

function Head({ title, href, children }: { title: string; href?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-bold text-slate-900">{title}</h2>
      <div className="flex items-center gap-3">
        {children}
        {href && <a href={href} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 no-print">⬇️ Excel</a>}
      </div>
    </div>
  );
}

function Bars({ rows, max, color }: { rows: { label: string; count: number }[]; max: number; color: string }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-center justify-between gap-2 text-sm"><span className="truncate text-slate-700">{r.label}</span><span className="font-semibold text-slate-900">{r.count}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`bar-grow h-full rounded-full ${color}`} style={{ width: `${(r.count / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return <p className="py-8 text-center text-sm text-slate-400">لا توجد بيانات في هذه الفترة</p>;
}
