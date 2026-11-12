import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTicketForView } from "@/actions/tickets";
import { isManager } from "@/lib/access";
import { EGYPTIAN, SOURCE_LABELS, TRIAGE_LABELS, TYPE_LABELS, slaState, transferTargets } from "@/lib/workflow";
import { SlaBadge, StatusBadge, TeamChip, TypeBadge } from "@/components/ui/badge";
import { SlaCountdown } from "@/components/tickets/sla-countdown";
import { displayName, formatBytes, formatDateTime, formatSince } from "@/lib/utils";
import { TicketActions } from "./actions-panel";
import { CommentBox } from "./comment-box";
import { UploadBox } from "./upload-box";
import { CommentBody } from "./comment-item";
import Link from "next/link";
import { canRequestAmbulance } from "@/lib/ambulance-access";
import { STATUS_AR as AMB_STATUS, ambulanceEnabled, ambulanceLink, ambulanceStatus } from "@/lib/ambulance";
import { describeEvent } from "@/lib/event-text";
import { RichText } from "@/components/ui/rich-text";
import { CopyButton } from "@/components/ui/copy-button";
import { Avatar } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getTicketForView(id);
  if (!view) notFound();
  const { ticket, perms, user } = view;

  const holders = ticket.teams.filter((t) => t.access === "holder");
  const [allTeams, people] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    // كل المستخدمين بيشوفوا التيكت — للمنشن، والإسناد بيتفلتر تحت على التيم اللي ماسكها
    prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: { id: true, username: true, fullName: true, role: true, teams: { select: { teamId: true } } },
      orderBy: { fullName: "asc" },
    }),
  ]);
  const targets = transferTargets(allTeams, user.teamIds, isManager(user), holders.map((h) => h.teamId));
  const holderIds = new Set(holders.map((h) => h.teamId));
  const assignable = people.filter((p) => p.role !== "viewer" && p.teams.some((t) => holderIds.has(t.teamId)));

  type Item =
    | { kind: "comment"; at: Date; c: (typeof ticket.comments)[number] }
    | { kind: "event"; at: Date; e: (typeof ticket.events)[number] };
  const timeline: Item[] = [
    ...ticket.comments.map((c) => ({ kind: "comment" as const, at: c.createdAt, c })),
    // تعديل وحذف التحديثات مش بيظهروا في سجل التذكرة — بيتسجلوا في السجل العام للمدير بس
    ...ticket.events.filter((e) => !HIDDEN_EVENTS.has(e.action)).map((e) => ({ kind: "event" as const, at: e.createdAt, e })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  // طلبات الإسعاف: بنحدّث حالتها من نظام الإسعاف لو آخر قراءة أقدم من دقيقتين
  let ambReqs = await prisma.ambulanceRequest.findMany({
    where: { ticketId: ticket.id }, orderBy: { createdAt: "desc" }, include: { createdBy: { select: { fullName: true } } },
  });
  if (ambulanceEnabled() && ambReqs.some((r) => !r.lastCheckedAt || Date.now() - r.lastCheckedAt.getTime() > 120_000)) {
    await Promise.all(ambReqs.map(async (r) => {
      try {
        const st = await ambulanceStatus(r.remoteId);
        if (st.status) await prisma.ambulanceRequest.update({ where: { id: r.id }, data: { lastStatus: st.status, lastCheckedAt: new Date() } });
      } catch { /* نظام الإسعاف مش متاح — آخر حالة معروفة */ }
    }));
    ambReqs = await prisma.ambulanceRequest.findMany({
      where: { ticketId: ticket.id }, orderBy: { createdAt: "desc" }, include: { createdBy: { select: { fullName: true } } },
    });
  }
  const canAmbulance = canRequestAmbulance(user) && ticket.status === "pending";

  const since = holders.reduce<Date | null>((a, h) => (!a || h.addedAt > a ? h.addedAt : a), null);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className={`card flex flex-wrap items-center gap-x-4 gap-y-2 border-r-4 p-4 ${ticket.status === "closed" ? "border-r-slate-400 bg-slate-50" : "border-r-brand-500 bg-brand-50/40"}`}>
          <span className="text-sm font-semibold text-slate-700">📍 التذكرة الآن:</span>
          {ticket.status === "closed" ? (
            <span className="text-sm text-slate-700">
              مغلقة{ticket.closedAt && <> {formatSince(ticket.closedAt)}</>}
              {ticket.closedBy && <> — أغلقها {displayName(ticket.closedBy.fullName)}</>}
            </span>
          ) : (
            <>
              <span className="flex flex-wrap items-center gap-1.5 text-sm text-slate-700">
                لدى {holders.map((h) => <TeamChip key={h.teamId} name={h.team.name} color={h.team.color} />)}
                {since && <span className="text-slate-500">{formatSince(since)}</span>}
              </span>
              <span className="text-sm text-slate-700">
                المسؤول: <b>{ticket.assignedTo ? displayName(ticket.assignedTo.fullName) : "لم يُسند بعد"}</b>
              </span>
              {ticket.receivedAt ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                  📥 استلمها {ticket.receivedBy ? displayName(ticket.receivedBy.fullName) : "—"} {formatSince(ticket.receivedAt)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                  ⏳ لم تُستلم بعد
                </span>
              )}
              {perms.canAct && !holders.some((h) => user.teamIds.includes(h.teamId)) && (
                <span className="w-full text-xs text-slate-500">
                  التذكرة ليست لدى فريقك — يمكنك التعديل عليها، وكل تعديل يُسجَّل باسمك في سجل التذكرة.
                </span>
              )}
            </>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className={`h-1.5 ${TYPE_BAND[ticket.type]}`} />
          <div className="p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-4">
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-sm ${TYPE_AVATAR[ticket.type]}`}>
                {ticket.beneficiaryName.trim().charAt(0)}
              </span>
              <div>
                <div className="flex items-center gap-1 font-mono text-sm text-slate-500">
                  {ticket.ticketNumber}<CopyButton text={ticket.ticketNumber} label="رقم التذكرة" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">{ticket.beneficiaryName}</h1>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ticket.teams.map((t) => (
                    <TeamChip key={t.teamId} name={t.team.name} color={t.team.color} observer={t.access === "observer"} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={ticket.type} />
              <StatusBadge status={ticket.status} />
              <SlaBadge state={slaState(ticket)} />
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Info label="مهلة الإنجاز">
              {ticket.status === "pending" ? <SlaCountdown deadline={ticket.slaDeadline.toISOString()} /> : formatDateTime(ticket.slaDeadline)}
            </Info>
            <Info label="تاريخ الإنشاء">{formatDateTime(ticket.createdAt)}</Info>
            <Info label="أنشأها">{displayName(ticket.createdBy.fullName)}</Info>
            <Info label="المسؤول">{ticket.assignedTo ? displayName(ticket.assignedTo.fullName) : "—"}</Info>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
            <Info label="الهاتف الأول" mono><Phone n={ticket.phone1} /></Info>
            <Info label="الهاتف الثاني" mono>{ticket.phone2 ? <Phone n={ticket.phone2} /> : "—"}</Info>
            <Info label="كود الحالة" mono>{ticket.caseCode ?? "—"}</Info>
            <Info label="السن">{ticket.age ?? "—"}</Info>
            <Info label="النوع">{ticket.gender ?? "—"}</Info>
            <Info label="مكان الحالة">{ticket.location ?? "—"}</Info>
            <Info label="صلة القرابة">{ticket.relationship}</Info>
            <Info label="الجنسية">{ticket.nationality}</Info>
            {ticket.nationality === EGYPTIAN
              ? <Info label="الرقم القومي" mono>{ticket.nationalId ?? "—"}</Info>
              : <Info label="رقم المفوضية" mono>{ticket.unhcrNumber ?? "—"}</Info>}
            <Info label="المصدر">{SOURCE_LABELS[ticket.source]}</Info>
            <Info label="نوع التذكرة">{TYPE_LABELS[ticket.type]}</Info>
            {ticket.triageLevel && <Info label="تصنيف الطبيب">{TRIAGE_LABELS[ticket.triageLevel]}</Info>}
            {ticket.researchDecision && (
              <Info label="قرار الأبحاث">
                {{ pending: "⏳ في الانتظار", accepted: "✅ مقبولة", rejected: "❌ مرفوضة" }[ticket.researchDecision]}
                {ticket.researchDecidedBy && <span className="text-xs text-slate-400"> — {displayName(ticket.researchDecidedBy.fullName)}</span>}
              </Info>
            )}
          </div>

          {ticket.description && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-medium text-slate-500">تفاصيل الحالة</div>
              <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-800"><RichText text={ticket.description} /></p>
            </div>
          )}

          {ticket.status === "closed" && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <span className="font-semibold">أُغلقت</span>
              {ticket.closedAt && <> في {formatDateTime(ticket.closedAt)}</>}
              {ticket.closedBy && <> بواسطة {displayName(ticket.closedBy.fullName)}</>}
              {ticket.closeCategory && (
                <div className="mt-1.5"><span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">سبب الإغلاق: {ticket.closeCategory}</span></div>
              )}
              {ticket.closeReason && <p className="mt-1 text-slate-700"><RichText text={ticket.closeReason} /></p>}
            </div>
          )}
          </div>
        </div>

        {(ambReqs.length > 0 || canAmbulance) && (
          <div className="card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <SectionTitle icon="🚑" title="طلبات الإسعاف" count={ambReqs.length} />
              {canAmbulance && (
                <Link href={`/tickets/${ticket.id}/ambulance`} className="no-print inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-red-600/20 transition hover:-translate-y-0.5 hover:bg-red-700">
                  🚑 طلب إسعاف
                </Link>
              )}
            </div>
            {ambReqs.length === 0 ? (
              <p className="text-sm text-slate-400">لم يُرسل أي طلب إسعاف لهذه التذكرة بعد.</p>
            ) : (
              <ul className="space-y-2">
                {ambReqs.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2.5 text-sm">
                    <div>
                      <a href={ambulanceLink(r.remoteId)} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:underline">
                        بلاغ إسعاف #{r.remoteId}
                      </a>
                      <span className="text-slate-500"> — {r.service} · موعد الخدمة {r.serviceDate}</span>
                      <div className="text-xs text-slate-400">أرسله {displayName(r.createdBy.fullName)} • {formatDateTime(r.createdAt)}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${AMB_TONE[r.lastStatus ?? ""] ?? "bg-slate-100 text-slate-600"}`}>
                      {AMB_STATUS[r.lastStatus ?? ""] ?? "غير معروف"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="card p-6">
          <SectionTitle icon="📎" title="المرفقات" count={ticket.attachments.length} />
          <ul className="space-y-1.5">
            {ticket.attachments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2.5 text-sm transition hover:border-brand-200 hover:bg-brand-50/40">
                <a href={`/api/attachments/${a.id}`} target="_blank" rel="noopener" className="flex min-w-0 items-center gap-2 font-medium text-brand-700 hover:underline">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold uppercase text-brand-700">{a.fileName.split(".").pop()?.slice(0, 4)}</span>
                  <span className="truncate">{a.fileName}</span>
                </a>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatBytes(a.size)} · {displayName(a.uploadedBy.fullName)} · {formatDateTime(a.createdAt)}
                </span>
              </li>
            ))}
            {ticket.attachments.length === 0 && <li className="text-sm text-slate-400">لا توجد مرفقات</li>}
          </ul>
          {perms.canComment && <div className="no-print mt-3"><UploadBox ticketId={ticket.id} /></div>}
        </div>

        <div className="card p-6">
          <SectionTitle icon="🕘" title="السجل والتحديثات" count={timeline.length} />
          <ol className="stagger relative space-y-4 before:absolute before:bottom-2 before:right-[15px] before:top-2 before:w-px before:bg-slate-200">
            {timeline.map((it) =>
              it.kind === "comment" ? (
                <li key={it.c.id} className="relative flex gap-3">
                  <Avatar name={it.c.author.fullName} className="relative z-10 ring-4" />
                  <div className={`min-w-0 flex-1 rounded-xl border p-3 ${it.c.kind === "note" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white shadow-sm"}`}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-800">
                        {displayName(it.c.author.fullName)} <bdi dir="ltr" className="font-normal text-slate-400">@{it.c.author.username}</bdi>
                        <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${it.c.kind === "note" ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
                          {it.c.kind === "note" ? "📝 ملاحظة" : "🔄 تحديث"}
                        </span>
                      </span>
                      <span className="text-slate-400">
                        {formatDateTime(it.c.createdAt)}
                      </span>
                    </div>
                    <CommentBody id={it.c.id} body={it.c.body} mine={it.c.authorId === user.id && user.role !== "viewer"}>
                      <p className="text-sm leading-relaxed text-slate-800"><RichText text={it.c.body} /></p>
                    </CommentBody>
                  </div>
                </li>
              ) : (
                <li key={it.e.id} className="relative flex items-start gap-3">
                  <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center">
                    <span className={`h-3 w-3 rounded-full ring-4 ring-white ${EVENT_DOT[it.e.action] ?? "bg-slate-300"}`} />
                  </span>
                  <div className="min-w-0 pt-1 text-xs">
                    <div className="text-sm text-slate-700"><RichText text={describeEvent(it.e.action, it.e.metadata)} /></div>
                    <div className="mt-0.5 text-slate-400">{it.e.actor ? displayName(it.e.actor.fullName) : "النظام"} • {formatDateTime(it.e.createdAt)}</div>
                  </div>
                </li>
              ),
            )}
          </ol>
          {perms.canComment && (
            <div className="no-print mt-4">
              <CommentBox ticketId={ticket.id} people={people.map((p) => ({ username: p.username, fullName: p.fullName }))} />
            </div>
          )}
        </div>
      </div>

      <div className="no-print space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pb-4">
        <TicketActions
          ticketId={ticket.id}
          perms={perms}
          isManager={isManager(user)}
          targets={targets.map((t) => ({ id: t.id, name: t.name }))}
          assignable={assignable.map((p) => ({ id: p.id, fullName: p.fullName }))}
          assignedToId={ticket.assignedToId}
          isEmergency={ticket.type === "emergency"}
          details={{
            age: ticket.age, gender: ticket.gender, location: ticket.location,
            beneficiaryName: ticket.beneficiaryName, phone1: ticket.phone1, phone2: ticket.phone2,
            caseCode: ticket.caseCode, relationship: ticket.relationship, nationality: ticket.nationality,
            nationalId: ticket.nationalId, unhcrNumber: ticket.unhcrNumber, description: ticket.description,
          }}
        />
      </div>
    </div>
  );
}

const TYPE_BAND: Record<string, string> = {
  emergency: "bg-gradient-to-l from-red-500 to-rose-400",
  new_case: "bg-gradient-to-l from-violet-500 to-fuchsia-400",
  follow_up: "bg-gradient-to-l from-brand-600 to-brand-400",
};
const TYPE_AVATAR: Record<string, string> = {
  emergency: "bg-gradient-to-br from-red-500 to-rose-600",
  new_case: "bg-gradient-to-br from-violet-500 to-violet-700",
  follow_up: "bg-gradient-to-br from-brand-500 to-brand-700",
};

function SectionTitle({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-base">{icon}</span>
      {title}
      {count !== undefined && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{count}</span>}
    </h2>
  );
}

// رقم التليفون بيتضغط عليه يتصل على طول (من الموبايل)
function Phone({ n }: { n: string }) {
  return (
    <a href={`tel:${n}`} className="inline-flex items-center gap-1 text-slate-800 hover:text-brand-700">
      {n}
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
    </a>
  );
}

function Info({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50/80 px-3 py-2.5 ring-1 ring-slate-100">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className={`mt-0.5 font-medium text-slate-800 ${mono ? "font-mono text-sm" : ""}`} dir={mono ? "ltr" : undefined} style={mono ? { textAlign: "right" } : undefined}>
        {children}
      </div>
    </div>
  );
}

const AMB_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800", "in-progress": "bg-sky-100 text-sky-800",
  "pending-close": "bg-violet-100 text-violet-800", completed: "bg-emerald-100 text-emerald-800", cancelled: "bg-slate-200 text-slate-600",
};

const HIDDEN_EVENTS = new Set(["comment_edited", "comment_deleted"]);

const EVENT_DOT: Record<string, string> = {
  ambulance_sent: "bg-red-600",
  created: "bg-brand-500",
  transferred: "bg-sky-500",
  triaged: "bg-pink-500",
  research_accepted: "bg-emerald-500",
  research_rejected: "bg-red-500",
  closed: "bg-slate-500",
  reopened: "bg-amber-500",
  sla_breached: "bg-red-600",
};
