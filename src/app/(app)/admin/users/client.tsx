"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkUsers, createUser, importUsers, resetPassword, updateUser, type ImportResult } from "@/actions/admin";
import { toast } from "@/components/ui/toast";
import { formatSince } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { ApprovalPermsPanel } from "./approval-perms";
import { Avatar } from "@/components/ui/avatar";

type Role = "manager" | "supervisor" | "agent" | "viewer";
type Team = { id: string; name: string; color: string };
type U = {
  id: string; username: string; fullName: string; role: Role; isActive: boolean;
  canReopen: boolean; canExport: boolean; teamIds: string[]; approvalPerms: Record<string, boolean>;
  lastLoginAt: string | null; mustChangePassword: boolean;
};
const ROLES: Record<Role, string> = { manager: "مدير", supervisor: "مشرف", agent: "موظف", viewer: "مشاهد" };

export function UsersClient({ users, teams, meId }: { users: U[]; teams: Team[]; meId: string }) {
  const [mode, setMode] = useState<"none" | "one" | "bulk">("none");
  const [q, setQ] = useState("");
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState("");
  const term = q.trim().toLowerCase();
  const shown = users.filter((u) =>
    (!term || u.fullName.toLowerCase().includes(term) || u.username.includes(term)) &&
    (!teamId || (teamId === "none" ? u.teamIds.length === 0 : u.teamIds.includes(teamId))) &&
    (!role || (role === "inactive" ? !u.isActive : role === "never" ? !u.lastLoginAt : u.role === role)));
  const filtered = !!(term || teamId || role);
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkTeam, setBulkTeam] = useState("");
  const [busy, startBulk] = useTransition();
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pickable = shown.filter((u) => u.id !== meId);
  const allPicked = pickable.length > 0 && pickable.every((u) => picked.has(u.id));

  function bulk(op: Parameters<typeof bulkUsers>[1], arg?: string) {
    startBulk(async () => {
      const r = await bulkUsers([...picked], op, arg);
      if (!r.ok) { toast(r.error, "error"); return; }
      toast(`تم تطبيق الإجراء على ${r.count} مستخدم`);
      setPicked(new Set());
      router.refresh();
    });
  }

  function exportCsv() {
    const cell = (v: string) => `"${(/^[=+\-@]/.test(v) ? "'" + v : v).replace(/"/g, '""')}"`;
    const lines = [["الاسم", "اسم المستخدم", "الدور", "الفرق", "نشط", "آخر دخول"], ...shown.map((u) => [
      u.fullName, u.username, ROLES[u.role], teams.filter((t) => u.teamIds.includes(t.id)).map((t) => t.name).join(" + "),
      u.isActive ? "نعم" : "لا", u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("ar-EG") : "لم يدخل بعد",
    ])].map((r) => r.map(cell).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "users.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4">
      {mode === "none" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setMode("one")}>+ مستخدم جديد</Button>
          <Button variant="secondary" onClick={() => setMode("bulk")}>إضافة مجموعة مستخدمين</Button>
        </div>
      )}
      {mode === "one" && <UserEditor teams={teams} onDone={() => setMode("none")} />}
      {mode === "bulk" && <BulkImport teams={teams} onDone={() => setMode("none")} />}

      <div className="card grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو اسم المستخدم…" className="pr-9" />
        </div>
        <Select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="الفريق">
          <option value="">كل الفرق</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          <option value="none">بدون فريق</option>
        </Select>
        <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="الدور">
          <option value="">كل الأدوار</option>
          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          <option value="inactive">الموقوفون</option>
          <option value="never">لم يسجّلوا الدخول بعد</option>
        </Select>
      </div>

      <div className="flex items-center justify-between px-1 text-sm text-slate-500">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(pickable.map((u) => u.id)))} />
          {filtered ? `${shown.length} من ${users.length} مستخدم` : `${users.length} مستخدم`}
        </label>
        <span className="flex items-center gap-3">
          {filtered && <button type="button" className="text-brand-700 hover:underline" onClick={() => { setQ(""); setTeamId(""); setRole(""); }}>مسح التصفية</button>}
          <button type="button" className="text-brand-700 hover:underline" onClick={exportCsv}>⬇️ تصدير Excel</button>
        </span>
      </div>

      {picked.size > 0 && (
        <div className="animate-expand sticky top-20 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50/95 p-3 text-sm shadow-lg backdrop-blur">
          <span className="font-bold text-brand-900">{picked.size} محدد</span>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => bulk("activate")}>تفعيل</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => { if (confirm(`إيقاف ${picked.size} مستخدم؟ لن يستطيعوا الدخول.`)) bulk("deactivate"); }}>إيقاف</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => {
            const pw = prompt("كلمة المرور المؤقتة الجديدة (8 أحرف على الأقل) — سيُطلب منهم تغييرها عند الدخول:");
            if (pw) bulk("reset", pw);
          }}>إعادة تعيين كلمة المرور</Button>
          <span className="mx-1 h-5 w-px bg-brand-200" />
          <Select value={bulkTeam} onChange={(e) => setBulkTeam(e.target.value)} className="!w-44 !py-1.5 text-xs" aria-label="فريق">
            <option value="">اختر فريقًا…</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Button size="sm" variant="secondary" disabled={busy || !bulkTeam} onClick={() => bulk("addTeam", bulkTeam)}>إضافة للفريق</Button>
          <Button size="sm" variant="secondary" disabled={busy || !bulkTeam} onClick={() => bulk("removeTeam", bulkTeam)}>إزالة من الفريق</Button>
          <button type="button" className="mr-auto text-xs text-slate-500 hover:text-slate-800" onClick={() => setPicked(new Set())}>إلغاء التحديد</button>
        </div>
      )}

      <div className="card divide-y divide-slate-100 overflow-hidden">
        {shown.map((u) => <UserRow key={u.id} u={u} teams={teams} isMe={u.id === meId} picked={picked.has(u.id)} onPick={() => toggle(u.id)} />)}
        {shown.length === 0 && (
          <div className="py-14 text-center text-sm text-slate-400"><div className="mb-2 text-4xl">🔍</div>لا يوجد مستخدم مطابق</div>
        )}
      </div>
    </div>
  );
}

const ROLE_TONE: Record<Role, string> = {
  manager: "bg-slate-800 text-white", supervisor: "bg-violet-100 text-violet-800",
  agent: "bg-slate-100 text-slate-700", viewer: "bg-slate-100 text-slate-500",
};

function UserRow({ u, teams, isMe, picked, onPick }: { u: U; teams: Team[]; isMe: boolean; picked: boolean; onPick: () => void }) {
  const [editing, setEditing] = useState(false);
  const names = teams.filter((t) => u.teamIds.includes(t.id));
  if (editing) return <div className="animate-expand bg-slate-50/60 p-3"><UserEditor teams={teams} user={u} onDone={() => setEditing(false)} /></div>;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors ${picked ? "bg-brand-50/60" : "hover:bg-slate-50/70"} ${u.isActive ? "" : "opacity-60"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <input type="checkbox" checked={picked} disabled={isMe} onChange={onPick} aria-label={`تحديد ${u.fullName}`} className="h-4 w-4 shrink-0" />
        <Avatar name={u.fullName} size="md" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 font-semibold text-slate-900">
            <span className="truncate">{u.fullName}</span>
            {isMe && <span className="text-xs font-normal text-slate-400">(أنت)</span>}
            <bdi dir="ltr" className="font-mono text-xs font-normal text-slate-400">@{u.username}</bdi>
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-xs">
            <span className={`rounded-full px-2 py-0.5 font-medium ${ROLE_TONE[u.role]}`}>{ROLES[u.role]}</span>
            {!u.isActive && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">موقوف</span>}
            {u.canReopen && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-800">إعادة فتح</span>}
            {u.canExport && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">تصدير</span>}
            {names.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-slate-700 ring-1 ring-slate-200">
                <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />{t.name}
              </span>
            ))}
            {names.length === 0 && <span className="text-amber-700">⚠ ليس عضوًا في أي فريق</span>}
            <span suppressHydrationWarning className={u.lastLoginAt ? "text-slate-400" : "text-amber-700"}>
              · {u.lastLoginAt ? `آخر دخول ${formatSince(new Date(u.lastLoginAt))}` : "لم يسجّل الدخول بعد"}
            </span>
          </div>
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
        <Label>الفرق</Label>
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
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.canReopen} onChange={(e) => set("canReopen", e.target.checked)} /> صلاحية إعادة فتح التذاكر</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.canExport} onChange={(e) => set("canExport", e.target.checked)} /> صلاحية التصدير إلى Excel</label>
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

function BulkImport({ teams, onDone }: { teams: Team[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lines, setLines] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [res, setRes] = useState<ImportResult | null>(null);
  const count = lines.split(/\r?\n/).filter((l) => l.trim()).length;

  return (
    <div className="card space-y-4 border-brand-300 p-5">
      <div>
        <h2 className="font-semibold text-slate-900">إضافة مجموعة مستخدمين</h2>
        <p className="mt-1 text-sm text-slate-500">
          كل سطر لمستخدم واحد: <b>الاسم، اسم المستخدم أو الإيميل، الفريق</b> — مفصولة بفاصلة أو منسوخة من Excel مباشرة (3 أعمدة).
          من الإيميل يُؤخذ ما قبل @ كاسم مستخدم. لأكثر من فريق اكتب بينها +.
        </p>
        <p className="mt-1 text-xs text-slate-500">الفرق المتاحة: {teams.map((t) => t.name).join(" · ")}</p>
      </div>
      <Textarea dir="ltr" rows={10} className="font-mono text-xs" value={lines} onChange={(e) => setLines(e.target.value)}
        placeholder={"Ahmed Selim, ahmed.selim@mersal-ngo.org, فريق SHC\nRana Wael, rana.wael@mersal-ngo.org, مركز الاتصال"} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label required>كلمة المرور المؤقتة للجميع</Label>
          <Input dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 أحرف على الأقل" />
          <p className="mt-1 text-xs text-slate-500">سيُطلب من كل مستخدم تغييرها عند أول دخول.</p>
        </div>
        <div>
          <Label>الدور</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
      </div>
      {res && !res.ok && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{res.error}</div>}
      {res?.ok && (
        <div className="space-y-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <div>✅ تمت إضافة {res.created} مستخدم.</div>
          {res.skipped.length > 0 && (
            <div className="text-amber-800">
              <div className="font-semibold">لم يُضف {res.skipped.length}:</div>
              <ul className="mt-1 list-inside list-disc text-xs">
                {res.skipped.map((s, i) => (
                  <li key={i}><bdi dir="ltr">{s.text}</bdi> — {s.reason}{s.line > 0 && ` (سطر ${s.line})`}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button disabled={pending || count === 0 || password.length < 8} onClick={() => start(async () => {
          const r = await importUsers({ lines, password, role });
          setRes(r);
          if (r.ok) { setLines(""); router.refresh(); }
        })}>{pending ? "جاري الإضافة..." : `إضافة ${count} مستخدم`}</Button>
        <Button variant="ghost" onClick={onDone}>إغلاق</Button>
      </div>
    </div>
  );
}
