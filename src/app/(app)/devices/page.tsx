import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/access";
import { DEVICE_STAGE_LABELS, DEVICE_STATUS_LABELS, DEVICE_TYPES, normalizeDigits, type DeviceStage, type DeviceStatus } from "@/lib/workflow";
import { PageHeader } from "@/components/ui/page-header";
import { CountUp } from "@/components/ui/count-up";
import { Input, Select } from "@/components/ui/form";
import { formatDateTime, formatSince } from "@/lib/utils";
import { AddDevice } from "./add-device";
import { STATUS_TONE } from "@/components/devices/status-tone";

export const dynamic = "force-dynamic";

const PENDING: DeviceStage[] = ["doctor_review", "research_review", "decisions_review", "awaiting_stock", "awaiting_delivery"];

export default async function DevicesPage({ searchParams }: { searchParams: Promise<{ type?: string; status?: string; q?: string; code?: string; tab?: string }> }) {
  const s = await auth();
  if (!s) redirect("/login");
  const f = await searchParams;
  const tab = f.tab === "patients" ? "patients" : f.tab === "list" || f.q || f.status || f.type ? "list" : "overview";
  const q = normalizeDigits(f.q?.trim() ?? "");

  const [byStatus, pending, waitingStock] = await Promise.all([
    prisma.device.groupBy({ by: ["type", "status"], _count: true }),
    prisma.deviceRequest.groupBy({ by: ["deviceType", "stage"], where: { stage: { in: PENDING }, ticket: { status: "pending" } }, _count: true }),
    prisma.deviceRequest.count({ where: { stage: "awaiting_stock", ticket: { status: "pending" } } }),
  ]);
  const cell = (type: string, st: DeviceStatus) => byStatus.find((r) => r.type === type && r.status === st)?._count ?? 0;
  const pend = (type: string) => pending.filter((r) => r.deviceType === type).reduce((a, r) => a + r._count, 0);
  const sum = (st: DeviceStatus) => byStatus.filter((r) => r.status === st).reduce((a, r) => a + r._count, 0);
  const total = byStatus.reduce((a, r) => a + r._count, 0);
  const pendingTotal = pending.reduce((a, r) => a + r._count, 0);
  const types = [...new Set([...DEVICE_TYPES, ...byStatus.map((r) => r.type)])];
  const stageCount = (st: DeviceStage) => pending.filter((r) => r.stage === st).reduce((a, r) => a + r._count, 0);

  return (
    <div className="space-y-5">
      <PageHeader icon="🩺" title="الأجهزة الطبية" subtitle="المخزون، والأجهزة اللي مع المرضى، والصيانة، وطلبات الأجهزة">
        {s.user.role !== "viewer" && (
          <Link href="/tickets/new/device" className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-sky-600/20 transition hover:-translate-y-0.5 hover:bg-sky-700">
            + طلب جهاز
          </Link>
        )}
      </PageHeader>

      <div className="stagger grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon="🧮" label="إجمالي الأجهزة" value={total} tone="bg-slate-100 text-slate-700" href="/devices?tab=list" />
        <Kpi icon="📦" label="في المخزن" value={sum("in_stock")} tone="bg-emerald-50 text-emerald-700" href="/devices?status=in_stock" />
        <Kpi icon="🏠" label="مع المرضى" value={sum("with_patient")} tone="bg-sky-50 text-sky-700" href="/devices?status=with_patient" />
        <Kpi icon="🔧" label="في الهندسية" value={sum("maintenance")} tone="bg-amber-50 text-amber-700" href="/devices?status=maintenance" />
        <Kpi icon="🛒" label="بره الاستوك" value={sum("out_of_stock")} tone="bg-red-50 text-red-700" href="/devices?status=out_of_stock" />
        <Kpi icon="📝" label="طلبات مفتوحة" value={pendingTotal} tone="bg-violet-50 text-violet-700" href="/tickets?type=device_request&status=pending" sub={waitingStock ? `${waitingStock} مستني توفر جهاز` : undefined} />
      </div>

      <div className="flex flex-wrap gap-2">
        {[["overview", "📊 حسب النوع"], ["list", "📋 كل الأجهزة"], ["patients", "👥 حسب كود المريض"]].map(([k, l]) => (
          <Link key={k} href={`/devices?tab=${k}`}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${tab === k ? "bg-brand-600 text-white shadow-md shadow-brand-600/20" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:-translate-y-0.5"}`}>{l}</Link>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="card p-5">
            <h2 className="mb-3 font-bold text-slate-900">📝 الطلبات المفتوحة حسب المرحلة</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {PENDING.map((st) => (
                <div key={st} className={`rounded-xl p-3 text-center ring-1 ${st === "awaiting_stock" && stageCount(st) ? "bg-amber-50 ring-amber-200" : "bg-slate-50 ring-slate-100"}`}>
                  <div className="text-2xl font-bold text-slate-900"><CountUp value={stageCount(st)} /></div>
                  <div className="text-[11px] text-slate-500">{DEVICE_STAGE_LABELS[st]}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card overflow-x-auto">
            <table className="data-table rows-in min-w-[820px]">
              <thead><tr><th>نوع الجهاز</th><th>الإجمالي</th><th>في المخزن</th><th>مع المرضى</th><th>في الهندسية</th><th>بره الاستوك</th><th>طلبات مستنية</th><th>الوضع</th></tr></thead>
              <tbody>
                {types.map((t) => {
                  const inS = cell(t, "in_stock"), p = pend(t);
                  const all = inS + cell(t, "with_patient") + cell(t, "maintenance") + cell(t, "out_of_stock");
                  return (
                    <tr key={t} className="group relative">
                      <td><Link href={`/devices?type=${encodeURIComponent(t)}`} className="font-semibold text-slate-800 after:absolute after:inset-0 group-hover:text-brand-700">{t}</Link></td>
                      <td className="font-semibold">{all}</td>
                      <td className={inS ? "font-bold text-emerald-700" : "text-slate-400"}>{inS}</td>
                      <td>{cell(t, "with_patient")}</td>
                      <td className={cell(t, "maintenance") ? "text-amber-700" : "text-slate-400"}>{cell(t, "maintenance")}</td>
                      <td className={cell(t, "out_of_stock") ? "text-red-600" : "text-slate-400"}>{cell(t, "out_of_stock")}</td>
                      <td className={p ? "font-semibold text-violet-700" : "text-slate-400"}>{p}</td>
                      <td>
                        {p > inS ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">ناقص {p - inS}</span>
                          : inS ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">متوفر</span>
                          : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">لا يوجد</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "list" && <DeviceList user={s.user} q={q} type={f.type} status={f.status} />}
      {tab === "patients" && <Patients code={normalizeDigits(f.code?.trim() ?? "")} />}
    </div>
  );
}

async function DeviceList({ user, q, type, status }: { user: { role: string }; q: string; type?: string; status?: string }) {
  const where: Prisma.DeviceWhereInput = {
    ...(type && { type }),
    ...(status && status in DEVICE_STATUS_LABELS && { status: status as DeviceStatus }),
    ...(q && {
      OR: [
        { serial: { contains: q, mode: "insensitive" } }, { internalPacking: { contains: q, mode: "insensitive" } },
        { currentTicket: { OR: [{ caseCode: { contains: q } }, { beneficiaryName: { contains: q, mode: "insensitive" } }] } },
      ],
    }),
  };
  const devices = await prisma.device.findMany({
    where, orderBy: [{ type: "asc" }, { serial: "asc" }], take: 300,
    include: { currentTicket: { select: { id: true, ticketNumber: true, beneficiaryName: true, caseCode: true, deviceRequest: { select: { deliveredAt: true } } } } },
  });
  return (
    <div className="space-y-4">
      {user.role === "manager" && <AddDevice />}
      <form method="get" className="card grid grid-cols-1 gap-3 p-4 md:grid-cols-5">
        <input type="hidden" name="tab" value="list" />
        <Input name="q" defaultValue={q} placeholder="سيريال، Internal Packing، كود أو اسم المريض…" className="md:col-span-2" />
        <Select name="type" defaultValue={type ?? ""}><option value="">كل الأنواع</option>{DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
        <Select name="status" defaultValue={status ?? ""}><option value="">كل الحالات</option>{Object.entries(DEVICE_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <div className="flex gap-2">
          <button className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">تصفية</button>
          <Link href="/devices?tab=list" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">مسح</Link>
        </div>
      </form>
      <div className="px-1 text-sm text-slate-500">{devices.length} جهاز{devices.length === 300 && " (أول 300 — استخدم التصفية)"}</div>
      <div className="card overflow-x-auto">
        <table className="data-table rows-in min-w-[820px]">
          <thead><tr><th>الجهاز</th><th>السيريال</th><th>Internal Packing</th><th>الحالة</th><th>مع المريض</th><th>آخر تحديث</th></tr></thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="group relative">
                <td><Link href={`/devices/${d.id}`} className="font-medium text-slate-800 after:absolute after:inset-0 group-hover:text-brand-700">{d.type}</Link></td>
                <td className="font-mono text-sm">{d.serial}</td>
                <td className="font-mono text-xs text-slate-500">{d.internalPacking ?? "—"}</td>
                <td><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[d.status]}`}>{DEVICE_STATUS_LABELS[d.status]}</span></td>
                <td className="text-xs">
                  {d.currentTicket ? (
                    <span><b className="text-slate-800">{d.currentTicket.beneficiaryName}</b> <span className="font-mono text-slate-400">#{d.currentTicket.caseCode}</span>
                      {d.currentTicket.deviceRequest?.deliveredAt && <span className="block text-slate-400">من {formatSince(d.currentTicket.deviceRequest.deliveredAt).replace("منذ ", "")}</span>}
                    </span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="text-xs text-slate-500">{formatDateTime(d.updatedAt)}</td>
              </tr>
            ))}
            {devices.length === 0 && <tr><td colSpan={6} className="py-14 text-center text-sm text-slate-400"><div className="mb-2 text-4xl">📦</div>لا توجد أجهزة مطابقة{user.role === "manager" && " — أضف أول جهاز من الزرار فوق"}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// كل كود مريض أخد كام جهاز (معاه دلوقتي + اللي استلمها قبل كده)
async function Patients({ code }: { code: string }) {
  const reqs = await prisma.deviceRequest.findMany({
    where: { deliveredAt: { not: null }, ...(code && { ticket: { caseCode: { contains: code } } }) },
    include: { ticket: { select: { id: true, ticketNumber: true, beneficiaryName: true, caseCode: true } } },
    orderBy: { deliveredAt: "desc" },
    take: 2000,
  });
  const devIds = reqs.map((r) => r.deviceId).filter((x): x is string => !!x);
  const devs = new Map((await prisma.device.findMany({ where: { id: { in: devIds } }, select: { id: true, serial: true } })).map((d) => [d.id, d.serial]));
  const map = new Map<string, { code: string; name: string; now: typeof reqs; past: typeof reqs }>();
  for (const r of reqs) {
    const k = r.ticket.caseCode ?? "—";
    const g = map.get(k) ?? { code: k, name: r.ticket.beneficiaryName, now: [], past: [] };
    (r.stage === "with_patient" ? g.now : g.past).push(r);
    map.set(k, g);
  }
  const rows = [...map.values()].sort((a, b) => b.now.length - a.now.length || b.past.length - a.past.length);
  return (
    <div className="space-y-4">
      <form method="get" className="card flex flex-wrap gap-3 p-4">
        <input type="hidden" name="tab" value="patients" />
        <Input name="code" defaultValue={code} placeholder="كود المريض…" dir="ltr" className="max-w-xs" />
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">بحث</button>
        {code && <Link href="/devices?tab=patients" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">الكل</Link>}
      </form>
      <div className="card overflow-x-auto">
        <table className="data-table rows-in min-w-[760px]">
          <thead><tr><th>كود المريض</th><th>الاسم</th><th>معاه دلوقتي</th><th>الأجهزة اللي معاه</th><th>استلم قبل كده</th></tr></thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.code}>
                <td className="font-mono font-semibold">{g.code}</td>
                <td className="font-medium text-slate-800">{g.name}</td>
                <td><span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${g.now.length ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-400"}`}>{g.now.length}</span></td>
                <td className="text-xs">
                  <div className="flex flex-wrap gap-1">
                    {g.now.map((r) => (
                      <Link key={r.id} href={`/tickets/${r.ticket.id}`} className="rounded-md bg-white px-2 py-0.5 ring-1 ring-slate-200 hover:ring-brand-300">
                        {r.deviceType} <span className="font-mono text-slate-400">{r.deviceId ? devs.get(r.deviceId) : ""}</span>
                      </Link>
                    ))}
                    {!g.now.length && <span className="text-slate-300">—</span>}
                  </div>
                </td>
                <td className="text-xs text-slate-500">{g.past.length ? `${g.past.length} (${[...new Set(g.past.map((r) => r.deviceType))].join("، ")})` : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="py-14 text-center text-sm text-slate-400">{code ? "لا توجد أجهزة اتصرفت للكود ده" : "لم يُصرف أي جهاز بعد"}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, tone, href, sub }: { icon: string; label: string; value: number; tone: string; href: string; sub?: string }) {
  return (
    <Link href={href} className="card card-hover group flex items-center gap-3 p-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl transition-transform duration-300 group-hover:scale-110 ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-tight text-slate-900"><CountUp value={value} /></div>
        <div className="truncate text-xs text-slate-500">{label}</div>
        {sub && <div className="truncate text-[11px] font-medium text-amber-700">{sub}</div>}
      </div>
    </Link>
  );
}

