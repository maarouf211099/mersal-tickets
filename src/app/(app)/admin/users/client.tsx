"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, resetPassword, updateUser } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { ApprovalPermsPanel } from "./approval-perms";

type Role = "manager" | "supervisor" | "agent" | "viewer";
type Team = { id: string; name: string; color: string };
type U = {
  id: string; username: string; fullName: string; role: Role; isActive: boolean;
  canReopen: boolean; canExport: boolean; teamIds: string[]; approvalPerms: Record<string, boolean>;
};
const ROLES: Record<Role, string> = { manager: "مدير", supervisor: "مشرف", agent: "موظف", viewer: "مشاهد" };

export function UsersClient({ users, teams, meId }: { users: U[]; teams: Team[]; meId: string }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4">
      {!adding
        ? <Button onClick={() => setAdding(true)}>+ مستخدم جديد</Button>
        : <UserEditor teams={teams} onDone={() => setAdding(false)} />}
      <div className="space-y-3">
        {users.map((u) => <UserRow key={u.id} u={u} teams={teams} isMe={u.id === meId} />)}
      </div>
    </div>
  );
}

function UserRow({ u, teams, isMe }: { u: U; teams: Team[]; isMe: boolean }) {
  const [editing, setEditing] = useState(false);
  const names = teams.filter((t) => u.teamIds.includes(t.id));
  if (editing) return <UserEditor teams={teams} user={u} onDone={() => setEditing(false)} />;
  return (
    <div className={`card flex flex-wrap items-center justify-between gap-3 p-4 ${u.isActive ? "" : "opacity-60"}`}>
      <div>
        <div className="font-semibold text-slate-900">{u.fullName} {isMe && <span className="text-xs text-slate-400">(انت)</span>}</div>
        <div className="font-mono text-xs text-slate-500" dir="ltr" style={{ textAlign: "right" }}>@{u.username}</div>
        <div className="mt-1 flex flex-wrap gap-1 text-xs">
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-white">{ROLES[u.role]}</span>
          {!u.isActive && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">موقوف</span>}
          {u.canReopen && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-800">إعادة فتح</span>}
          {u.canExport && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">تصدير</span>}
          {names.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />{t.name}
            </span>
          ))}
          {names.length === 0 && <span className="text-amber-700">⚠ مش في أي تيم</span>}
        </div>
      </div>
      <div className="flex items-start gap-2">
        <ApprovalPermsPanel userId={u.id} currentPerms={u.approvalPerms} />
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>تعديل</Button>
      </div>
    </div>
  );
}

function UserEditor({ teams, user, onDone }: { teams: Team[]; user?: U; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    username: user?.username ?? "", fullName: user?.fullName ?? "", password: "",
    role: (user?.role ?? "agent") as Role, teamIds: user?.teamIds ?? [],
    canReopen: user?.canReopen ?? false, canExport: user?.canExport ?? false, isActive: user?.isActive ?? true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggleTeam = (id: string) =>
    set("teamIds", f.teamIds.includes(id) ? f.teamIds.filter((x) => x !== id) : [...f.teamIds, id]);

  function save() {
    setErr(null);
    start(async () => {
      const r = user
        ? await updateUser(user.id, { fullName: f.fullName, role: f.role, teamIds: f.teamIds, canReopen: f.canReopen, canExport: f.canExport, isActive: f.isActive })
        : await createUser(f);
      if (!r.ok) { setErr(r.error); return; }
      if (user && f.password) {
        const p = await resetPassword(user.id, f.password);
        if (!p.ok) { setErr(p.error); return; }
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="card space-y-4 border-brand-300 p-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <Label required>اسم المستخدم</Label>
          <Input dir="ltr" value={f.username} disabled={!!user} onChange={(e) => set("username", e.target.value)} placeholder="ahmed.atef" />
        </div>
        <div>
          <Label required>الاسم بالكامل</Label>
          <Input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </div>
        <div>
          <Label required={!user}>{user ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"}</Label>
          <Input dir="ltr" type="password" value={f.password} onChange={(e) => set("password", e.target.value)} />
        </div>
        <div>
          <Label>الدور</Label>
          <Select value={f.role} onChange={(e) => set("role", e.target.value as Role)}>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
      </div>
      <div>
        <Label>التيمات</Label>
        <div className="flex flex-wrap gap-2">
          {teams.map((t) => (
            <label key={t.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${f.teamIds.includes(t.id) ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}>
              <input type="checkbox" checked={f.teamIds.includes(t.id)} onChange={() => toggleTeam(t.id)} />
              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />{t.name}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.canReopen} onChange={(e) => set("canReopen", e.target.checked)} /> صلاحية إعادة فتح التيكت</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.canExport} onChange={(e) => set("canExport", e.target.checked)} /> صلاحية التصدير</label>
        {user && <label className="flex items-center gap-2"><input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} /> الحساب نشط</label>}
      </div>
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <div className="flex gap-2">
        <Button disabled={pending} onClick={save}>{pending ? "..." : "حفظ"}</Button>
        <Button variant="ghost" onClick={onDone}>إلغاء</Button>
      </div>
    </div>
  );
}
