"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form";
import { DetailsFields, type DetailsDefaults } from "@/components/tickets/details-fields";
import { displayName } from "@/lib/utils";
import { RESEARCH_REQUEST_TYPES } from "@/lib/workflow";
import { toast } from "@/components/ui/toast";
import {
  assignTicket, closeTicket, decideMersal, decideResearch, deleteTicket, receiveTicket, reopenTicket,
  transferTicket, triageTicket, updateTicketDetails,
} from "@/actions/tickets";

type Perms = {
  canAct: boolean; canClose: boolean; canReopen: boolean;
  canTriage: boolean; canResearch: boolean; canMersalDecide: boolean; canDelete: boolean; canReceive: boolean;
};

type Props = {
  ticketId: string;
  perms: Perms;
  isManager: boolean;
  targets: { id: string; name: string; isResearch?: boolean }[];
  casesOn?: boolean;
  assignable: { id: string; fullName: string }[];
  assignedToId: string | null;
  details: DetailsDefaults;
  isEmergency: boolean;
  closeCategories: string[];
  isDevice?: boolean;
  deviceWithPatient?: boolean;
};

export function TicketActions(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  function run(key: string, okText: string, fn: () => Promise<{ ok: boolean; error?: string; warning?: string }>, after?: () => void) {
    setWarn(null);
    setErr(null);
    setBusy(key);
    start(async () => {
      const r = await fn();
      setBusy(null);
      if (!r.ok) { setErr(r.error ?? "خطأ"); toast(r.error ?? "حدث خطأ", "error"); return; }
      toast(okText);
      if (r.warning) { setWarn(r.warning); toast(r.warning, "error"); }
      after?.();
      router.refresh();
    });
  }

  const nothing = !p.perms.canAct && !p.perms.canReopen && !p.perms.canDelete;

  return (
    <div className="space-y-4">
      {err && <div className="animate-expand rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {warn && <div className="animate-expand rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">⚠️ {warn}</div>}

      {p.perms.canReceive && !p.isDevice && (
        <div className="card animate-expand border-brand-300 bg-gradient-to-b from-brand-50 to-white p-4">
          <p className="mb-3 text-sm text-slate-700">
            {p.isEmergency ? "عند الاستلام تبدأ مهلة الإنجاز من جديد، وتُسند التذكرة إليك إن لم تكن مُسندة." : "اضغط «استلام» لتأكيد أن فريقك استلم التذكرة وبدأ العمل عليها، وتُسند إليك إن لم تكن مُسندة."}
          </p>
          <Button type="button" size="lg" className="w-full" loading={busy === "receive"} disabled={pending}
            onClick={() => run("receive", "تم استلام التذكرة", () => receiveTicket(p.ticketId))}>📥 استلام التذكرة</Button>
        </div>
      )}

      {p.perms.canTriage && <TriageCard pending={pending} onSubmit={(level, note) => run("triage", "تم تصنيف الحالة", () => triageTicket(p.ticketId, level, note))} />}
      {p.perms.canMersalDecide && !p.isDevice && <MersalDecisionCard pending={pending} busy={busy}
        onSubmit={(d, c, sp, clear) => run(`mersal-${d}`, d === "sponsor" ? "تم التكفل — اتحوّلت لطبيب المتابعة" : "تم القرار — اتحوّلت لـ Admin الطوارئ لإبلاغ الحالة", () => decideMersal(p.ticketId, d, c, sp), clear)} />}
      {p.perms.canResearch && <ResearchCard pending={pending} onSubmit={(d, c) => run("research", d === "accepted" ? "تم قبول الحالة" : "تم رفض الحالة وإغلاق التذكرة", () => decideResearch(p.ticketId, d, c))} />}

      {p.perms.canAct && !p.isDevice && (
        <TransferCard targets={p.targets} pending={pending} busy={busy === "transfer"}
          onSubmit={(teamId, note, name, rType, clear) => run("transfer", `تم التحويل إلى ${name}${rType ? ` — ${rType}` : ""}`, () => transferTicket(p.ticketId, teamId, note, rType), clear)} />
      )}

      {p.perms.canAct && (
        <Card title="المسؤول عن التذكرة" icon="👤">
          <AssignForm assignable={p.assignable} current={p.assignedToId} pending={pending} busy={busy === "assign"}
            onSave={(id) => run("assign", id ? "تم إسناد التذكرة" : "تم إلغاء الإسناد", () => assignTicket(p.ticketId, id))} />
        </Card>
      )}

      {p.perms.canAct && !p.isDevice && (
        <EditCard details={p.details} casesOn={p.casesOn} pending={pending} busy={busy === "edit"}
          onSubmit={(form, close) => run("edit", "تم حفظ التعديلات", () => updateTicketDetails(p.ticketId, form), close)} />
      )}

      {p.perms.canClose && !p.deviceWithPatient && (
        <CloseCard categories={p.closeCategories} pending={pending} busy={busy === "close"}
          onSubmit={(cat, t, clear) => run("close", "تم إغلاق التذكرة", () => closeTicket(p.ticketId, cat, t), clear)} />
      )}

      {p.perms.canReopen && (
        <NoteAction title="إعادة فتح" icon="🔄" placeholder="سبب إعادة الفتح (إلزامي)" button="إعادة فتح"
          variant="primary" pending={pending} busy={busy === "reopen"} onSubmit={(t, clear) => run("reopen", "تم إعادة فتح التذكرة", () => reopenTicket(p.ticketId, t), clear)} />
      )}

      <Card title="أخرى" icon="⋯">
        <div className="flex flex-col gap-2">
          <Button type="button" variant="secondary" onClick={() => window.print()}>🖨️ طباعة</Button>
          {p.perms.canDelete && (
            <Button type="button" variant="danger" disabled={pending}
              onClick={() => {
                if (!confirm("هل تريد حذف التذكرة نهائيًا مع سجلها ومرفقاتها؟ لا يمكن التراجع عن هذا الإجراء.")) return;
                run("delete", "تم حذف التذكرة", () => deleteTicket(p.ticketId), () => router.push("/tickets"));
              }}>
              🗑️ حذف نهائي (للمدير)
            </Button>
          )}
          {nothing && <p className="text-xs text-slate-500">حسابك للمشاهدة فقط — يمكنك متابعة التذكرة دون تعديلها.</p>}
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children, tone, icon }: { title: string; children: React.ReactNode; tone?: "doctor"; icon?: string }) {
  return (
    <div className={`card p-4 transition-shadow hover:shadow-md ${tone === "doctor" ? "border-pink-300 bg-gradient-to-b from-pink-50/70 to-white" : ""}`}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        {icon && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-sm">{icon}</span>}
        {title}
      </h3>
      {children}
    </div>
  );
}

function TriageCard({ pending, onSubmit }: { pending: boolean; onSubmit: (l: "emergency" | "urgent", note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Card title="🩺 تصنيف طبيب الخط الساخن" tone="doctor">
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة الطبيب (اختياري)" className="min-h-[70px]" />
      <div className="mt-3 grid grid-cols-1 gap-2">
        <Button type="button" variant="danger" disabled={pending} onClick={() => onSubmit("emergency", note)}>
          طارئة ← الأبحاث أولاً
        </Button>
        <Button type="button" variant="primary" disabled={pending} onClick={() => onSubmit("urgent", note)}>
          عاجلة ← طبيب المتابعة + الأبحاث معًا
        </Button>
      </div>
    </Card>
  );
}

function ResearchCard({ pending, onSubmit }: { pending: boolean; onSubmit: (d: "accepted" | "rejected", c: string) => void }) {
  const [comment, setComment] = useState("");
  return (
    <Card title="🔬 قرار الأبحاث" tone="doctor">
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="تعليق (إلزامي في حالة الرفض)" className="min-h-[70px]" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="primary" disabled={pending} onClick={() => onSubmit("accepted", comment)}>✅ قبول</Button>
        <Button type="button" variant="danger" disabled={pending || comment.trim().length < 3}
          onClick={() => { if (confirm("سيؤدي الرفض إلى إغلاق التذكرة. هل أنت متأكد؟")) onSubmit("rejected", comment); }}>❌ رفض وإغلاق</Button>
      </div>
    </Card>
  );
}

function MersalDecisionCard({ pending, busy, onSubmit }: {
  pending: boolean; busy: string | null;
  onSubmit: (d: "sponsor" | "exclude" | "close", c: string, sponsor: { amount: string; rate: string; duration: string } | undefined, clear: () => void) => void;
}) {
  const [mode, setMode] = useState<"" | "once" | "repeat">("");
  const [every, setEvery] = useState<"" | "يوميًا" | "شهريًا">("");
  const [duration, setDuration] = useState("");
  const [comment, setComment] = useState("");
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const rate = mode === "once" ? "مرة واحدة" : mode === "repeat" && every ? `متكرر — ${every}` : "";
  const short = comment.trim().length < 3;
  const clear = () => { setComment(""); setAmount(""); setMode(""); setEvery(""); setDuration(""); setSponsorOpen(false); };
  const go = (d: "exclude" | "close", ask: string) => { if (confirm(ask)) onSubmit(d, comment, undefined, clear); };
  return (
    <Card title="⚖️ قرار مرسال" tone="doctor">
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="اكتب القرار والتفاصيل — هيتضاف في سجل التذكرة (إلزامي في الاستبعاد والغلق)" className="min-h-[80px]" />
      <div className="mt-3 grid grid-cols-1 gap-2">
        {!sponsorOpen ? (
          <Button type="button" variant="primary" disabled={pending} onClick={() => setSponsorOpen(true)}>🤝 تكفل ← طبيب المتابعة</Button>
        ) : (
          <div className="animate-expand space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <p className="text-sm font-semibold text-emerald-900">🤝 بيانات التكفل</p>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="قيمة المساهمة (مثلًا: 1500 جنيه)" autoFocus />
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">معدل المساهمة</p>
              <div className="grid grid-cols-2 gap-1.5">
                {([["once", "مرة واحدة"], ["repeat", "متكرر"]] as const).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={mode === k} onClick={() => { setMode(k); if (k === "once") setEvery(""); }}
                    className={`rounded-lg border px-2 py-2 text-sm transition ${mode === k ? "border-emerald-500 bg-white font-semibold text-emerald-900 shadow-sm" : "border-slate-200 bg-white/60 text-slate-600 hover:border-slate-300"}`}>{l}</button>
                ))}
              </div>
              {mode === "repeat" && (
                <div className="animate-expand mt-1.5 grid grid-cols-2 gap-1.5">
                  {(["يوميًا", "شهريًا"] as const).map((x) => (
                    <button key={x} type="button" aria-pressed={every === x} onClick={() => setEvery(x)}
                      className={`rounded-lg border px-2 py-1.5 text-sm transition ${every === x ? "border-emerald-500 bg-emerald-600 font-semibold text-white" : "border-slate-200 bg-white/60 text-slate-600 hover:border-slate-300"}`}>{x}</button>
                  ))}
                </div>
              )}
            </div>
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="مدة القرار (مثلًا: 6 شهور)" />
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="primary" loading={busy === "mersal-sponsor"} disabled={pending || !amount.trim() || !rate || !duration.trim()}
                onClick={() => onSubmit("sponsor", comment, { amount, rate, duration }, clear)}>تأكيد التكفل</Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setSponsorOpen(false)}>إلغاء</Button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="danger" loading={busy === "mersal-exclude"} disabled={pending || short}
            onClick={() => go("exclude", "استبعاد الحالة؟ التذكرة هتروح لـ Admin الطوارئ يبلّغ الحالة.")}>🚫 استبعاد</Button>
          <Button type="button" variant="secondary" loading={busy === "mersal-close"} disabled={pending || short}
            onClick={() => go("close", "غلق الحالة؟ التذكرة هتروح لـ Admin الطوارئ يبلّغ الحالة.")}>🔒 غلق</Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">الاستبعاد والغلق بيروحوا لـ <b>Admin الطوارئ</b> يبلّغوا الحالة ويقفلوا التذكرة.</p>
    </Card>
  );
}

function TransferCard({ targets, pending, busy, onSubmit }: {
  targets: { id: string; name: string; isResearch?: boolean }[]; pending: boolean; busy: boolean;
  onSubmit: (teamId: string, note: string, name: string, researchType: string | undefined, clear: () => void) => void;
}) {
  const [teamId, setTeamId] = useState("");
  const [note, setNote] = useState("");
  const [rType, setRType] = useState("");
  const target = targets.find((t) => t.id === teamId);
  const needType = !!target?.isResearch;
  return (
    <Card title="التحويل إلى فريق آخر" icon="↪️">
      <Select value={teamId} onChange={(e) => { setTeamId(e.target.value); setRType(""); }}>
        <option value="">اختر الفريق...</option>
        {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
      {needType && (
        <div className="animate-expand mt-2">
          <p className="mb-1.5 text-xs font-semibold text-slate-600">نوع الطلب للأبحاث <span className="text-red-500">*</span></p>
          <div className="grid grid-cols-3 gap-1.5">
            {RESEARCH_REQUEST_TYPES.map((x) => (
              <button key={x} type="button" onClick={() => setRType(x)} aria-pressed={rType === x}
                className={`rounded-lg border px-2 py-2 text-sm transition ${rType === x ? "border-amber-500 bg-amber-50 font-semibold text-amber-900" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{x}</button>
            ))}
          </div>
        </div>
      )}
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب التحويل / ملاحظة (اختياري)" className="mt-2 min-h-[60px]" />
      <Button type="button" className="mt-2 w-full" disabled={pending || !teamId || (needType && !rType)} loading={busy}
        onClick={() => onSubmit(teamId, note, target?.name ?? "", needType ? rType : undefined, () => { setTeamId(""); setNote(""); setRType(""); })}>تحويل</Button>
    </Card>
  );
}

function AssignForm({ assignable, current, pending, busy, onSave }: {
  assignable: { id: string; fullName: string }[]; current: string | null; pending: boolean; busy: boolean; onSave: (id: string | null) => void;
}) {
  const [v, setV] = useState(current ?? "");
  return (
    <div className="flex gap-2">
      <Select value={v} onChange={(e) => setV(e.target.value)}>
        <option value="">— بدون —</option>
        {assignable.map((u) => <option key={u.id} value={u.id}>{displayName(u.fullName)}</option>)}
      </Select>
      <Button size="sm" variant="secondary" disabled={pending || v === (current ?? "")} loading={busy} onClick={() => onSave(v || null)}>حفظ</Button>
    </div>
  );
}

function EditCard({ details, casesOn, pending, busy, onSubmit }: {
  details: DetailsDefaults; casesOn?: boolean; pending: boolean; busy: boolean; onSubmit: (form: FormData, close: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card title="بيانات المستفيد" icon="📝">
      {!open ? (
        <Button type="button" variant="secondary" className="w-full" onClick={() => setOpen(true)}>✏️ تعديل البيانات</Button>
      ) : (
        <form className="animate-expand" onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget), () => setOpen(false)); }}>
          <DetailsFields d={details} casesOn={casesOn} />
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={pending} loading={busy}>حفظ</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function CloseCard({ categories, pending, busy, onSubmit }: {
  categories: string[]; pending: boolean; busy: boolean; onSubmit: (category: string, text: string, clear: () => void) => void;
}) {
  const [cat, setCat] = useState("");
  const [text, setText] = useState("");
  return (
    <Card title="إغلاق التذكرة" icon="✅">
      <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="سبب إغلاق التذكرة">
        <option value="">سبب إغلاق التذكرة (إلزامي)...</option>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="سبب الغلق / تفاصيل (اختياري)" className="mt-2 min-h-[60px]" />
      <Button type="button" variant="secondary" className="mt-2 w-full" disabled={pending || !cat} loading={busy}
        onClick={() => onSubmit(cat, text, () => { setCat(""); setText(""); })}>إغلاق التذكرة</Button>
    </Card>
  );
}

function NoteAction({ title, icon, placeholder, button, variant, pending, busy, onSubmit }: {
  title: string; icon: string; placeholder: string; button: string; variant: "primary" | "secondary";
  pending: boolean; busy: boolean; onSubmit: (text: string, clear: () => void) => void;
}) {
  const [text, setText] = useState("");
  return (
    <Card title={title} icon={icon}>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="min-h-[60px]" />
      <Button type="button" variant={variant} className="mt-2 w-full" disabled={pending || text.trim().length < 3} loading={busy}
        onClick={() => onSubmit(text, () => setText(""))}>{button}</Button>
    </Card>
  );
}
