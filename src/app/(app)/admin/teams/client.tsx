"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTeam } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";

type T = {
  id: string; code: string | null; name: string; description: string; color: string;
  isActive: boolean; isReceiver: boolean; transferOnlyFromId: string | null; members: number; open: number;
};

export function TeamsClient({ teams }: { teams: T[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3">
      {!adding ? <Button onClick={() => setAdding(true)}>+ تيم جديد</Button> : <TeamEditor teams={teams} onDone={() => setAdding(false)} />}
      {teams.map((t) => <TeamRow key={t.id} t={t} teams={teams} />)}
    </div>
  );
}

function TeamRow({ t, teams }: { t: T; teams: T[] }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <TeamEditor teams={teams} team={t} onDone={() => setEditing(false)} />;
  const from = teams.find((x) => x.id === t.transferOnlyFromId);
  return (
    <div className={`card flex flex-wrap items-center justify-between gap-3 p-4 ${t.isActive ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ background: t.color }} />
        <div>
          <div className="font-semibold text-slate-900">{t.name}</div>
          <div className="mt-1 flex flex-wrap gap-1 text-xs">
            {t.isReceiver && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">تيم استقبال</span>}
            {from && <span className="rounded-full bg-pink-100 px-2 py-0.5 text-pink-800">🔒 يظهر لـ {from.name} بس</span>}
            {!t.isActive && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">موقوف</span>}
            {t.code && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-slate-500">{t.code}</span>}
            <span className="text-slate-500">{t.members} عضو · {t.open} تيكت مفتوحة</span>
          </div>
        </div>
      </div>
      <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>تعديل</Button>
    </div>
  );
}

function TeamEditor({ teams, team, onDone }: { teams: T[]; team?: T; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    name: team?.name ?? "", description: team?.description ?? "", color: team?.color ?? "#0d9488",
    isReceiver: team?.isReceiver ?? true, isActive: team?.isActive ?? true,
    transferOnlyFromId: team?.transferOnlyFromId ?? null as string | null,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="card space-y-3 border-brand-300 p-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div><Label required>الاسم</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><Label>الوصف</Label><Input value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
        <div><Label>اللون</Label><Input type="color" value={f.color} onChange={(e) => set("color", e.target.value)} className="h-[42px] p-1" /></div>
      </div>
      <div>
        <Label>يظهر كاختيار تحويل لأعضاء تيم معيّن بس (اختياري)</Label>
        <Select value={f.transferOnlyFromId ?? ""} onChange={(e) => set("transferOnlyFromId", e.target.value || null)}>
          <option value="">— لأ، حسب &quot;تيم استقبال&quot; —</option>
          {teams.filter((x) => x.id !== team?.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Select>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.isReceiver} onChange={(e) => set("isReceiver", e.target.checked)} /> تيم استقبال (يتحول له من أي تيم)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} /> نشط</label>
      </div>
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <div className="flex gap-2">
        <Button disabled={pending} onClick={() => start(async () => {
          const r = await saveTeam(team?.id ?? null, f);
          if (!r.ok) setErr(r.error); else { router.refresh(); onDone(); }
        })}>{pending ? "..." : "حفظ"}</Button>
        <Button variant="ghost" onClick={onDone}>إلغاء</Button>
      </div>
    </div>
  );
}
