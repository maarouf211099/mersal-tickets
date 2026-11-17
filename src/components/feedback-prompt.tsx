"use client";

import { useEffect } from "react";

// رسالة تقييم النظام: بتظهر مرة واحدة لكل مستخدم بعد الدخول (الكود في public/mersal-feedback.js).
// لو FORM_URL فاضي الرسالة مش بتظهر. بعد UNTIL مش بتظهر خالص.
const FORM_URL = "";
const UNTIL = "2026-11-30";

export default function FeedbackPrompt({ system, name, user }: { system: string; name: string; user?: string }) {
  useEffect(() => {
    (window as unknown as { MERSAL_FEEDBACK: unknown }).MERSAL_FEEDBACK = {
      system, name, formUrl: FORM_URL, until: UNTIL, user: () => user || "",
    };
    if (!document.getElementById("mfb-js")) {
      const s = document.createElement("script");
      s.id = "mfb-js";
      s.src = "/mersal-feedback.js";
      s.defer = true;
      document.body.appendChild(s);
    }
  }, [system, name, user]);
  return null;
}
