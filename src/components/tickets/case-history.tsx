"use client";
import { useState, useTransition } from "react";
import { lookupCaseHistory } from "@/actions/devices";
import type { CaseHistory, CaseHistoryItem } from "@/lib/cases";

const fmt = (d: string | null) => {
  if (!d) return "";
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? d : new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeZone: "Africa/Cairo" }).format(t);
};

// آخر القرارات وآخر البحوث من سيستم الحالات — بتتحمّل أول ما حد يفتح التاب (مش مع كل فتح للتذكرة)
export function CaseHistoryCard({ ticketId, caseCode }: { ticketId: string; caseCode: string }) {
  const [tab, setTab] = useState<"decisions" | "investigations" | null>(null);
  const [data, setData] = useState<CaseHistory | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, start] = useTransition();

  function load() {
    setErr(null);
    start(async () => {
      const r = await lookupCaseHistory(ticketId);
      if (r.ok) setData(r.data); else setErr(r.error);
    });
  }
  function open(t: "decisions" | "investigations") {
    if (tab === t) { setTab(null); return; }
    setTab(t);
    if (!data && !loading) load();
  }

  const TABS = [
    { k: "decisions" as const, label: "⚖️ آخر القرارات", n: data?.decisions.length },
    { k: "investigations" as const, label: "🔬 آخر البحوث", n: data?.investigations.length },
  ];
  const items = tab && data ? data[tab] : [];

  return (
    <div className="card no-print p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-base">🗂️</span>
          من سيستم الحالات
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500" dir="ltr">#{caseCode}</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.k} type="button" onClick={() => open(t.k)} aria-pressed={tab === t.k}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${tab === t.k ? "bg-sky-600 text-white shadow-md shadow-sky-600/20" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:-translate-y-0.5 hover:text-slate-900"}`}>
              {t.label}
              {t.n !== undefined && <span className={`rounded-full px-1.5 text-xs ${tab === t.k ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{t.n}</span>}
            </button>
          ))}
        </div>
      </div>

      {tab && (
        <div className="animate-expand mt-4">
          {loading && <p className="py-6 text-center text-sm text-slate-400">جاري الجلب من سيستم الحالات…</p>}
          {!loading && err && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {err} <button type="button" onClick={load} className="mr-2 font-semibold underline">حاول تاني</button>
            </div>
          )}
          {!loading && data && items.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">{tab === "decisions" ? "مفيش قرارات مسجلة للحالة دي" : "مفيش بحوث مسجلة للحالة دي"}</p>
          )}
          {!loading && data && items.length > 0 && (
            <ol className="space-y-3">
              {items.map((x, i) => <Item key={i} x={x} first={i === 0} kind={tab} />)}
            </ol>
          )}
          {!loading && data && (
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>{data.name && `الحالة: ${data.name} — `}أحدث {items.length} من سيستم الحالات (للعرض فقط)</span>
              <button type="button" onClick={load} className="font-medium text-sky-700 hover:underline">🔄 تحديث</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Item({ x, first, kind }: { x: CaseHistoryItem; first: boolean; kind: "decisions" | "investigations" }) {
  return (
    <li className={`rounded-xl border p-3 ${first ? "border-sky-200 bg-sky-50/50" : "border-slate-100 bg-slate-50/60"}`}>
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {first && <span className="rounded-full bg-sky-600 px-2 py-0.5 font-semibold text-white">الأحدث</span>}
        {x.date && <span>📅 {fmt(x.date)}</span>}
        {x.author && <span>👤 {x.author}</span>}
      </div>
      {x.text && <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{kind === "investigations" && <b className="text-slate-500">الخلاصة: </b>}{x.text}</p>}
      {x.extra && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700"><b className="text-slate-500">التوصية: </b>{x.extra}</p>}
    </li>
  );
}
