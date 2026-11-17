"use client";

import { useEffect } from "react";

// رسالة تقييم النظام: بتظهر مرة واحدة لكل مستخدم بعد الدخول (الكود في public/mersal-feedback.js).
// الردود بتتسجل في جدول Feedback عن طريق /api/feedback. بعد UNTIL الرسالة مش بتظهر (النتايج تفضل متاحة).
const UNTIL = "2026-11-30";

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const msg = (data as { error?: unknown } | null)?.error;
    throw new Error(typeof msg === "string" && msg ? msg : "حصلت مشكلة في الاتصال — حاول تاني.");
  }
  return data;
}

// النتايج مش بتتعرض هنا (مفيش زرار 📊) — بتتجمع من كل الأنظمة في صفحة واحدة جوه سيستم الحالات.
export default function FeedbackPrompt({ system, name, user }: { system: string; name: string; user: string }) {
  useEffect(() => {
    const w = window as unknown as { MERSAL_FEEDBACK?: Record<string, unknown> };
    let active = true;
    w.MERSAL_FEEDBACK = {
      system,
      name,
      until: UNTIL,
      ready: () => active && !!user,
      user: () => user,
      submit: (data: unknown) => api("/api/feedback", { method: "POST", body: JSON.stringify(data) }),
      mine: async () => !!((await api("/api/feedback/mine")) as { submitted?: boolean } | null)?.submitted,
    };
    if (!document.getElementById("mfb-js")) {
      const s = document.createElement("script");
      s.id = "mfb-js";
      s.src = "/mersal-feedback.js";
      s.defer = true;
      document.body.appendChild(s);
    }
    return () => {
      active = false;
    };
  }, [system, name, user]);
  return null;
}
