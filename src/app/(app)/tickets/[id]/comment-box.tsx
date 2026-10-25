"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { addComment } from "@/actions/tickets";
import { cn, displayName } from "@/lib/utils";

type Person = { username: string; fullName: string };

export function CommentBox({ ticketId, people }: { ticketId: string; people: Person[] }) {
  const router = useRouter();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"update" | "note">("update");
  const [query, setQuery] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; warning?: string } | null>(null);

  // اقتراحات المنشن: بتظهر لما تكتب @
  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return people.filter((p) => p.username.includes(q) || p.fullName.includes(query)).slice(0, 6);
  }, [query, people]);

  function onChange(v: string) {
    setBody(v);
    const pos = ref.current?.selectionStart ?? v.length;
    const m = v.slice(0, pos).match(/(^|\s)@([^\s@]*)$/);
    setQuery(m ? m[2] : null);
  }

  function pick(p: Person) {
    const el = ref.current;
    const pos = el?.selectionStart ?? body.length;
    const before = body.slice(0, pos).replace(/@([^\s@]*)$/, `@${p.username} `);
    const next = before + body.slice(pos);
    setBody(next);
    setQuery(null);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(before.length, before.length); });
  }

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await addComment(ticketId, kind, body);
      if (!r.ok) { setMsg({ error: r.error }); return; }
      setBody("");
      if (r.warning) setMsg({ warning: r.warning });
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-2 flex gap-1 text-sm">
        {(["update", "note"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)}
            className={cn("rounded-full px-3 py-1", kind === k
              ? (k === "note" ? "bg-amber-200 text-amber-900" : "bg-slate-800 text-white")
              : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
            {k === "update" ? "🔄 تحديث" : "📝 ملاحظة"}
          </button>
        ))}
      </div>
      <div className="relative">
        <Textarea ref={ref} value={body} onChange={(e) => onChange(e.target.value)} disabled={pending}
          placeholder="اكتب تحديثًا أو ملاحظة... واستخدم @ للإشارة إلى زميل"
          className={kind === "note" ? "border-amber-300 bg-amber-50/40" : ""} />
        {suggestions.length > 0 && (
          <ul className="absolute right-2 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {suggestions.map((p) => (
              <li key={p.username}>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(p); }}
                  className="flex w-full items-center justify-between px-3 py-2 text-right text-sm hover:bg-brand-50">
                  <span>{displayName(p.fullName)}</span>
                  <span className="font-mono text-xs text-slate-400" dir="ltr">@{p.username}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {msg?.error && <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{msg.error}</div>}
      {msg?.warning && <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{msg.warning}</div>}
      <div className="mt-2 flex justify-end">
        <Button disabled={pending || body.trim().length === 0} onClick={submit}>{pending ? "..." : "إرسال"}</Button>
      </div>
    </div>
  );
}
