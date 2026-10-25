"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/form";
import { DetailsFields, type DetailsDefaults } from "@/components/tickets/details-fields";
import { displayName } from "@/lib/utils";
import {
  assignTicket, closeTicket, decideResearch, deleteTicket, reopenTicket,
  transferTicket, triageTicket, updateTicketDetails,
} from "@/actions/tickets";

type Perms = {
  canAct: boolean; canClose: boolean; canReopen: boolean;
  canTriage: boolean; canResearch: boolean; canDelete: boolean;
};

type Props = {
  ticketId: string;
  perms: Perms;
  isManager: boolean;
  targets: { id: string; name: string }[];
  assignable: { id: string; fullName: string }[];
  assignedToId: string | null;
  details: DetailsDefaults;
};

export function TicketActions(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "خطأ");
      else { after?.(); router.refresh(); }
    });
  }

  const nothing = !p.perms.canAct && !p.perms.canReopen && !p.perms.canDelete;

  return (
    <div className="space-y-4">
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      {p.perms.canTriage && <TriageCard pending={pending} onSubmit={(level, note) => run(() => triageTicket(p.ticketId, level, note))} />}
      {p.perms.canResearch && <ResearchCard pending={pending} onSubmit={(d, c) => run(() => decideResearch(p.ticketId, d, c))} />}

      {p.perms.canAct && (
        <TransferCard targets={p.targets} pending={pending}
          onSubmit={(teamId, note) => run(() => transferTicket(p.ticketId, teamId, note))} />
      )}

      {p.perms.canAct && (
        <Card title="المسؤول عن التذكرة">
          <AssignForm assignable={p.assignable} current={p.assignedToId} pending={pending}
            onSave={(id) => run(() => assignTicket(p.ticketId, id))} />
        </Card>
      )}

      {p.perms.canAct && (
        <EditCard details={p.details} pending={pending}
          onSubmit={(form, close) => run(() => updateTicketDetails(p.ticketId, form), close)} />
      )}

      {p.perms.canClose && (
        <NoteAction title="إغلاق التذكرة" placeholder="ملخص ما تم أو سبب الإغلاق (إلزامي)" button="إغلاق التذكرة"
          variant="secondary" pending={pending} onSubmit={(t, clear) => run(() => closeTicket(p.ticketId, t), clear)} />
      )}

      {p.perms.canReopen && (
        <NoteAction title="إعادة فتح" placeholder="سبب إعادة الفتح (إلزامي)" button="🔄 إعادة فتح"
          variant="primary" pending={pending} onSubmit={(t, clear) => run(() => reopenTicket(p.ticketId, t), clear)} />
      )}

      <Card title="أخرى">
        <div className="flex flex-col gap-2">
          <Button type="button" variant="secondary" onClick={() => window.print()}>🖨️ طباعة</Button>
          {p.perms.canDelete && (
            <Button type="button" variant="danger" disabled={pending}
              onClick={() => {
                if (!confirm("هل تريد حذف التذكرة نهائيًا مع سجلها ومرفقاتها؟ لا يمكن التراجع عن هذا الإجراء.")) return;
                run(() => deleteTicket(p.ticketId), () => router.push("/tickets"));
              }}>
              🗑️ حذف نهائي (للمدير)
            </Button>
          )}
          {nothing && <p className="text-xs text-slate-500">التذكرة ليست لدى فريقك — يمكنك متابعتها وإضافة تحديثات فقط.</p>}
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "doctor" }) {
  return (
    <div className={`card p-4 ${tone === "doctor" ? "border-pink-300 bg-pink-50/40" : ""}`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
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

function TransferCard({ targets, pending, onSubmit }: {
  targets: { id: string; name: string }[]; pending: boolean; onSubmit: (teamId: string, note: string) => void;
}) {
  const [teamId, setTeamId] = useState("");
  const [note, setNote] = useState("");
  return (
    <Card title="التحويل إلى فريق آخر">
      <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
        <option value="">اختر الفريق...</option>
        {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب التحويل / ملاحظة (اختياري)" className="mt-2 min-h-[60px]" />
      <Button type="button" className="mt-2 w-full" disabled={pending || !teamId}
        onClick={() => onSubmit(teamId, note)}>تحويل</Button>
    </Card>
  );
}

function AssignForm({ assignable, current, pending, onSave }: {
  assignable: { id: string; fullName: string }[]; current: string | null; pending: boolean; onSave: (id: string | null) => void;
}) {
  const [v, setV] = useState(current ?? "");
  return (
    <div className="flex gap-2">
      <Select value={v} onChange={(e) => setV(e.target.value)}>
        <option value="">— بدون —</option>
        {assignable.map((u) => <option key={u.id} value={u.id}>{displayName(u.fullName)}</option>)}
      </Select>
      <Button size="sm" variant="secondary" disabled={pending || v === (current ?? "")} onClick={() => onSave(v || null)}>حفظ</Button>
    </div>
  );
}

function EditCard({ details, pending, onSubmit }: {
  details: DetailsDefaults; pending: boolean; onSubmit: (form: FormData, close: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card title="بيانات المستفيد">
      {!open ? (
        <Button type="button" variant="secondary" className="w-full" onClick={() => setOpen(true)}>✏️ تعديل البيانات</Button>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget), () => setOpen(false)); }}>
          <DetailsFields d={details} />
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={pending}>حفظ</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function NoteAction({ title, placeholder, button, variant, pending, onSubmit }: {
  title: string; placeholder: string; button: string; variant: "primary" | "secondary";
  pending: boolean; onSubmit: (text: string, clear: () => void) => void;
}) {
  const [text, setText] = useState("");
  return (
    <Card title={title}>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="min-h-[60px]" />
      <Button type="button" variant={variant} className="mt-2 w-full" disabled={pending || text.trim().length < 3}
        onClick={() => onSubmit(text, () => setText(""))}>{button}</Button>
    </Card>
  );
}
