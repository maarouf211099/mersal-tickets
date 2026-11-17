import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/access";
import { DEVICE_STAGE_LABELS, DEVICE_STATUS_LABELS, TEAM, type DeviceStatus } from "@/lib/workflow";
import { STATUS_TONE } from "@/components/devices/status-tone";
import { formatDateTime } from "@/lib/utils";
import { DeviceManage } from "./manage";

export const dynamic = "force-dynamic";

const ACTION_AR: Record<string, string> = {
  added: "إضافة للمخزن", edited: "تعديل البيانات", status: "تغيير الحالة", delivered: "صرف لمريض", returned: "استلام من مريض",
};
const MOVES: { from: DeviceStatus; to: DeviceStatus; teams: string[]; label: string; note?: boolean }[] = [
  { from: "in_stock", to: "maintenance", teams: [TEAM.WAREHOUSE, TEAM.ENGINEERING], label: "🔧 تحويل للهندسية" },
  { from: "maintenance", to: "in_stock", teams: [TEAM.ENGINEERING], label: "✅ سليم — رجوع للمخزن" },
  { from: "maintenance", to: "out_of_stock", teams: [TEAM.ENGINEERING], label: "🛒 بره الاستوك — للمشتريات", note: true },
  { from: "in_stock", to: "out_of_stock", teams: [TEAM.ENGINEERING, TEAM.WAREHOUSE], label: "🛒 بره الاستوك — للمشتريات", note: true },
  { from: "out_of_stock", to: "in_stock", teams: [TEAM.PROCUREMENT], label: "📦 اتوفر — رجوع للمخزن" },
  { from: "out_of_stock", to: "maintenance", teams: [TEAM.PROCUREMENT], label: "🔧 تحويل للهندسية" },
];

export default async function DevicePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await auth();
  if (!s) redirect("/login");
  const { id } = await params;
  const d = await prisma.device.findUnique({
    where: { id },
    include: {
      createdBy: { select: { fullName: true } },
      currentTicket: { select: { id: true, ticketNumber: true, beneficiaryName: true, caseCode: true, phone1: true, deviceRequest: { select: { deliveredAt: true, stage: true } } } },
      events: { orderBy: { createdAt: "desc" }, include: { actor: { select: { fullName: true } }, ticket: { select: { id: true, ticketNumber: true, beneficiaryName: true } } } },
    },
  });
  if (!d) notFound();
  const history = await prisma.deviceRequest.findMany({
    where: { deviceId: d.id }, orderBy: { deliveredAt: "desc" },
    include: { ticket: { select: { id: true, ticketNumber: true, beneficiaryName: true, caseCode: true } } },
  });
  const mgr = isManager(s.user);
  const moves = MOVES.filter((m) => m.from === d.status && (mgr || m.teams.some((t) => s.user.teamCodes.includes(t))))
    .map(({ to, label, note }) => ({ to, label, note: !!note }));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/devices?tab=list" className="text-sm text-slate-500 hover:text-brand-700">→ كل الأجهزة</Link>
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-3xl">🩺</span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{d.type}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span>السيريال: <b className="font-mono text-slate-800" dir="ltr">{d.serial}</b></span>
              <span>Internal Packing: <b className="font-mono text-slate-800" dir="ltr">{d.internalPacking ?? "—"}</b></span>
            </div>
          </div>
        </div>
        <span className={`rounded-full px-4 py-1.5 text-sm font-bold ${STATUS_TONE[d.status]}`}>{DEVICE_STATUS_LABELS[d.status]}</span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {d.currentTicket && (
            <div className="card border-sky-200 bg-sky-50/40 p-5">
              <h2 className="mb-2 font-bold text-slate-900">🏠 الجهاز مع المريض</h2>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <b className="text-slate-900">{d.currentTicket.beneficiaryName}</b> <span className="font-mono text-slate-500">#{d.currentTicket.caseCode}</span>
                  {d.currentTicket.phone1 && <span className="mr-3 font-mono text-slate-500" dir="ltr">{d.currentTicket.phone1}</span>}
                  {d.currentTicket.deviceRequest?.deliveredAt && <div className="text-xs text-slate-500">اتصرف في {formatDateTime(d.currentTicket.deviceRequest.deliveredAt)}</div>}
                </div>
                <Link href={`/tickets/${d.currentTicket.id}`} className="rounded-lg bg-white px-3 py-1.5 font-mono text-xs text-brand-700 ring-1 ring-sky-200 hover:ring-brand-400">{d.currentTicket.ticketNumber}</Link>
              </div>
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-3 font-bold text-slate-900">👥 المرضى اللي استلموا الجهاز ({history.length})</h2>
            {history.length === 0 ? <p className="text-sm text-slate-400">لم يُصرف لأي مريض بعد</p> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><b>{h.ticket.beneficiaryName}</b> <span className="font-mono text-xs text-slate-400">#{h.ticket.caseCode}</span></span>
                    <span className="text-xs text-slate-500">
                      {h.deliveredAt && `من ${formatDateTime(h.deliveredAt)}`}{h.returnedAt && ` لحد ${formatDateTime(h.returnedAt)}`} — {DEVICE_STAGE_LABELS[h.stage]}
                      <Link href={`/tickets/${h.ticket.id}`} className="mr-2 font-mono text-brand-700 hover:underline">{h.ticket.ticketNumber}</Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-bold text-slate-900">🕘 سجل الجهاز</h2>
            <ol className="relative space-y-3 border-r-2 border-slate-100 pr-4">
              {d.events.map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span className="absolute -right-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-sky-500" />
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-slate-800">{ACTION_AR[e.action] ?? e.action}</b>
                    {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus && (
                      <span className="text-xs text-slate-500">{DEVICE_STATUS_LABELS[e.fromStatus]} ← {DEVICE_STATUS_LABELS[e.toStatus]}</span>
                    )}
                    {e.ticket && <Link href={`/tickets/${e.ticket.id}`} className="text-xs text-brand-700 hover:underline">{e.ticket.beneficiaryName} ({e.ticket.ticketNumber})</Link>}
                  </div>
                  {e.note && <p className="mt-0.5 whitespace-pre-wrap text-slate-600">{e.note}</p>}
                  <div className="text-xs text-slate-400">{e.actor?.fullName ?? "النظام"} — {formatDateTime(e.createdAt)}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-5">
          <DeviceManage device={{ id: d.id, type: d.type, serial: d.serial, internalPacking: d.internalPacking, notes: d.notes }}
            moves={moves} isManager={mgr} canDelete={mgr && d.status !== "with_patient" && history.length === 0} />
          <div className="card space-y-1.5 p-4 text-sm text-slate-600">
            {d.notes && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-slate-700">{d.notes}</p>}
            <p>أضافه: <b>{d.createdBy.fullName}</b></p>
            <p>تاريخ الإضافة: {formatDateTime(d.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
