import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTicketForView } from "@/actions/tickets";
import { isManager } from "@/lib/access";
import { SOURCE_LABELS, TRIAGE_LABELS, TYPE_LABELS, slaState, transferTargets } from "@/lib/workflow";
import { SlaBadge, StatusBadge, TeamChip, TypeBadge } from "@/components/ui/badge";
import { SlaCountdown } from "@/components/tickets/sla-countdown";
import { displayName, formatBytes, formatDateTime } from "@/lib/utils";
import { TicketActions } from "./actions-panel";
import { CommentBox } from "./comment-box";
import { UploadBox } from "./upload-box";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getTicketForView(id);
  if (!view) notFound();
  const { ticket, perms, user } = view;

  const holders = ticket.teams.filter((t) => t.access === "holder");
  const teamIds = ticket.teams.map((t) => t.teamId);
  const [allTeams, people] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    // اللي يقدروا يشوفوا التيكت — للمنشن والإسناد
    prisma.user.findMany({
      where: {
        isActive: true,
        OR: [{ role: "manager" }, { id: ticket.createdById }, { teams: { some: { teamId: { in: teamIds } } } }],
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
    ...ticket.events.map((e) => ({ kind: "event" as const, at: e.createdAt, e })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="card p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-mono text-sm text-slate-500">{ticket.ticketNumber}</div>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">{ticket.beneficiaryName}</h1>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ticket.teams.map((t) => (
                  <TeamChip key={t.teamId} name={t.team.name} color={t.team.color} observer={t.access === "observer"} />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={ticket.type} />
              <StatusBadge status={ticket.status} />
              <SlaBadge state={slaState(ticket)} />
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3 text-sm md:grid-cols-4">
            <Info label="مهلة الإنجاز">
              {ticket.status === "pending" ? <SlaCountdown deadline={ticket.slaDeadline.toISOString()} /> : formatDateTime(ticket.slaDeadline)}
            </Info>
            <Info label="تاريخ الإنشاء">{formatDateTime(ticket.createdAt)}</Info>
            <Info label="أنشأها">{displayName(ticket.createdBy.fullName)}</Info>
            <Info label="المسؤول">{ticket.assignedTo ? displayName(ticket.assignedTo.fullName) : "—"}</Info>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
            <Info label="الهاتف الأول" mono>{ticket.phone1}</Info>
            <Info label="الهاتف الثاني" mono>{ticket.phone2 ?? "—"}</Info>
            <Info label="كود الحالة" mono>{ticket.caseCode ?? "—"}</Info>
            <Info label="صلة القرابة">{ticket.relationship}</Info>
            <Info label="الجنسية">{ticket.nationality}</Info>
            {ticket.nationalId
              ? <Info label="الرقم القومي" mono>{ticket.nationalId}</Info>
              : <Info label="رقم المفوضية" mono>{ticket.unhcrNumber ?? "—"}</Info>}
            <Info label="المصدر">{SOURCE_LABELS[ticket.source]}</Info>
            <Info label="النوع">{TYPE_LABELS[ticket.type]}</Info>
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
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{ticket.description}</p>
            </div>
          )}

          {ticket.status === "closed" && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <span className="font-semibold">أُغلقت</span>
              {ticket.closedAt && <> في {formatDateTime(ticket.closedAt)}</>}
              {ticket.closedBy && <> بواسطة {displayName(ticket.closedBy.fullName)}</>}
              {ticket.closeReason && <p className="mt-1 whitespace-pre-wrap text-slate-700">{ticket.closeReason}</p>}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="mb-3 font-semibold text-slate-900">المرفقات ({ticket.attachments.length})</h2>
          <ul className="space-y-1.5">
            {ticket.attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <a href={`/api/attachments/${a.id}`} target="_blank" rel="noopener" className="truncate text-brand-700 hover:underline">
                  📎 {a.fileName}
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
          <h2 className="mb-4 font-semibold text-slate-900">السجل والتحديثات</h2>
          <ol className="space-y-3">
            {timeline.map((it) =>
              it.kind === "comment" ? (
                <li key={it.c.id} className={`rounded-lg border p-3 ${it.c.kind === "note" ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {displayName(it.c.author.fullName)} <bdi dir="ltr" className="text-slate-400">@{it.c.author.username}</bdi>
                      <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${it.c.kind === "note" ? "bg-amber-200 text-amber-900" : "bg-slate-200 text-slate-700"}`}>
                        {it.c.kind === "note" ? "📝 ملاحظة" : "🔄 تحديث"}
                      </span>
                    </span>
                    <span className="text-slate-500">{formatDateTime(it.c.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{highlightMentions(it.c.body)}</p>
                </li>
              ) : (
                <li key={it.e.id} className="border-r-2 border-slate-200 pr-3 text-xs text-slate-600">
                  <div className="text-sm text-slate-700">{describeEvent(it.e.action, it.e.metadata)}</div>
                  <div className="text-slate-400">{it.e.actor ? displayName(it.e.actor.fullName) : "النظام"} • {formatDateTime(it.e.createdAt)}</div>
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

      <div className="no-print space-y-4">
        <TicketActions
          ticketId={ticket.id}
          perms={perms}
          isManager={isManager(user)}
          targets={targets.map((t) => ({ id: t.id, name: t.name }))}
          assignable={assignable.map((p) => ({ id: p.id, fullName: p.fullName }))}
          assignedToId={ticket.assignedToId}
          details={{
            beneficiaryName: ticket.beneficiaryName, phone1: ticket.phone1, phone2: ticket.phone2,
            caseCode: ticket.caseCode, relationship: ticket.relationship, nationality: ticket.nationality,
            nationalId: ticket.nationalId, unhcrNumber: ticket.unhcrNumber, description: ticket.description,
          }}
        />
      </div>
    </div>
  );
}

function Info({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 text-slate-800 ${mono ? "font-mono text-sm" : ""}`} dir={mono ? "ltr" : undefined} style={mono ? { textAlign: "right" } : undefined}>
        {children}
      </div>
    </div>
  );
}

function highlightMentions(body: string) {
  return body.split(/(@[a-zA-Z0-9._-]{2,})/g).map((part, i) =>
    part.startsWith("@") ? <bdi key={i} dir="ltr" className="font-semibold text-brand-700">{part}</bdi> : part,
  );
}

type Meta = Record<string, unknown> | null;
function describeEvent(action: string, metadata: unknown): string {
  const m = (metadata ?? {}) as NonNullable<Meta>;
  const list = (v: unknown) => (Array.isArray(v) ? v.join(" + ") : String(v ?? ""));
  const withNote = (s: string, note: unknown) => (note ? `${s} — "${note}"` : s);
  switch (action) {
    case "created": return `أُنشئت التذكرة وحُوِّلت إلى ${m.to}`;
    case "transferred": return withNote(`حُوِّلت من ${list(m.from) || "—"} إلى ${m.to}`, m.note);
    case "triaged": return withNote(`صنّفها طبيب الخط الساخن حالةً ${m.level === "urgent" ? "عاجلة" : "طارئة"} ← ${list(m.to)}`, m.note);
    case "research_accepted": return withNote(`قبلت الأبحاث الحالة ← ${list(m.to)}`, m.comment);
    case "research_rejected": return withNote("رفضت الأبحاث الحالة وأُغلقت التذكرة", m.comment);
    case "closed": return withNote("أُغلقت التذكرة", m.reason);
    case "reopened": return withNote("أُعيد فتح التذكرة", m.note);
    case "assigned": return m.to ? `أُسندت إلى ${m.to}` : "أُلغي الإسناد";
    case "attachment_added": return `أُضيف مرفق: ${list(m.files)}`;
    case "sla_breached": return "⛔ تجاوزت التذكرة مهلة الإنجاز";
    case "details_updated": {
      const changes = (m.changes as { label: string; from: string | null; to: string | null }[]) ?? [];
      return "تعديل البيانات: " + changes.map((c) => `${c.label} (${c.from ?? "—"} ← ${c.to ?? "—"})`).join("، ");
    }
    default: return action;
  }
}
