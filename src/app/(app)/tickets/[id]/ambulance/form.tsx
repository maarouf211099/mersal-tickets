"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendToAmbulance } from "@/actions/ambulance";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import {
  AMBULANCE_SERVICES, AMBULANCE_SOURCES, GOVERNORATES, REPORT_TYPES, TRIP_TYPES, WAIT_MODES,
} from "@/lib/ambulance-options";

type Defaults = {
  patient: string; phone: string; phone2: string; nationality: string; age: string; gender: string;
  code: string; complaint: string; reporterRel: string; fromLoc: string;
};

// نفس خانات «بلاغ إسعاف جديد» في نظام الإسعاف (للحالات اللي فيها مريض)
export function AmbulanceForm({ ticketId, staffName, d }: { ticketId: string; staffName: string; d: Defaults }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [service, setService] = useState<string>(AMBULANCE_SERVICES[0]);
  const [trip, setTrip] = useState(TRIP_TYPES[0]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      setErr(null);
      const fd = new FormData(e.currentTarget);
      start(async () => {
        const r = await sendToAmbulance(ticketId, fd);
        if (!r.ok) { setErr(r.error); toast(r.error, "error"); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
        toast(`تم إرسال طلب الإسعاف — بلاغ رقم ${r.remoteId}`);
        router.push(`/tickets/${ticketId}`);
        router.refresh();
      });
    }}>
      {err && <div className="animate-expand rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

      <Section title="نوع الخدمة" tone="brand">
        <div className="flex flex-wrap gap-2">
          {AMBULANCE_SERVICES.map((sv) => (
            <label key={sv} className={`cursor-pointer rounded-xl border-2 px-4 py-2 text-sm font-semibold transition ${service === sv ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
              <input type="radio" name="service" value={sv} checked={service === sv} onChange={() => setService(sv)} className="sr-only" />{sv}
            </label>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <F label="مصدر البلاغ"><Select name="source" defaultValue="الطوارئ">{AMBULANCE_SOURCES.map((x) => <option key={x}>{x}</option>)}</Select></F>
        </div>
      </Section>

      <Section title="👤 الموظف المسئول عن الطلب" tone="violet">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <F label="اسم الموظف" req><Input name="staff_name" defaultValue={staffName} maxLength={80} required /></F>
          <F label="رقم الموظف" req><Input name="staff_phone" type="tel" dir="ltr" maxLength={20} required /></F>
          <F label="اسم من ينوب عنه" req><Input name="deputy_name" maxLength={80} required /></F>
          <F label="رقم من ينوب عنه" req><Input name="deputy_phone" type="tel" dir="ltr" maxLength={20} required /></F>
        </div>
      </Section>

      {service === "حالة مرسال" && (
        <Section title="بيانات حالة مرسال" tone="amber">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2"><F label="الموافقة الطبية نصًا" req><Textarea name="medical_approval" required className="min-h-[70px]" /></F></div>
            <F label="اسم الطبيب صاحب الموافقة الطبية" req><Input name="doctor_name" required /></F>
            <F label="الكود" req><Input name="code" defaultValue={d.code} dir="ltr" required /></F>
          </div>
        </Section>
      )}

      <Section title="المُبلّغ" tone="emerald">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <F label="اسم المبلغ عن الحالة"><Input name="reporter" /></F>
          <F label="صلة قرابة المبلغ"><Input name="reporter_rel" defaultValue={d.reporterRel} placeholder="ابن / زوجة…" /></F>
          <F label="رقم موبايل المبلغ" req><Input name="phone" type="tel" dir="ltr" defaultValue={d.phone} required /></F>
          <F label="رقم موبايل آخر"><Input name="phone2" type="tel" dir="ltr" defaultValue={d.phone2} /></F>
        </div>
      </Section>

      <Section title="بيانات الحالة" tone="sky">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2"><F label="اسم الحالة" req><Input name="patient" defaultValue={d.patient} required /></F></div>
          <F label="الجنسية"><Input name="nationality" defaultValue={d.nationality || "مصري"} /></F>
          <F label="النوع"><Select name="gender" defaultValue={d.gender}><option value="">اختر</option><option>ذكر</option><option>أنثى</option></Select></F>
          <F label="السن"><Input name="age" type="number" min={0} max={120} dir="ltr" defaultValue={d.age} /></F>
          <F label="الوزن (كجم)"><Input name="weight" type="number" min={0} max={400} dir="ltr" /></F>
          <div className="col-span-2 md:col-span-4"><F label="الشكوى الصحية للحالة (بالتفصيل)" req><Textarea name="complaint" defaultValue={d.complaint} required className="min-h-[70px]" /></F></div>
          <div className="col-span-2"><YesNo name="chronic" label="هل الحالة تعاني من أي أمراض مزمنة أو معدية؟" /></div>
          <div className="col-span-2"><YesNo name="oxygen" label="هل الحالة ستحتاج إلى أكسجين في السيارة؟" /></div>
        </div>
      </Section>

      <Section title="المشوار" tone="brand">
        <Label>نوع البلاغ</Label>
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPES.map((x, i) => (
            <label key={x} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="radio" name="report_type" value={x} defaultChecked={i === 1} />{x}
            </label>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <F label="نوع المشوار"><Select name="trip_type" value={trip} onChange={(e) => setTrip(e.target.value)}>{TRIP_TYPES.map((x) => <option key={x}>{x}</option>)}</Select></F>
          <F label="المحافظة" req><Select name="governorate" defaultValue="القاهرة">{GOVERNORATES.map((x) => <option key={x}>{x}</option>)}</Select></F>
          <F label="الحي"><Input name="district" /></F>
          <div className="md:col-span-3"><F label="المكان المتواجد به المريض (اسم الشارع، رقم العقار، الدور، علامة مميزة)" req><Textarea name="from_loc" defaultValue={d.fromLoc} required className="min-h-[60px]" /></F></div>
          <div className="md:col-span-3"><F label="📍 لوكيشن مكان المريض (لينك جوجل ماب أو إحداثيات)"><Input name="from_map" dir="ltr" placeholder="https://maps.app.goo.gl/…" /></F></div>
          <div className="md:col-span-3"><F label="العنوان المتجه إليه المريض (رقم العقار، اسم الشارع، علامة مميزة)"><Textarea name="to_loc" className="min-h-[60px]" /></F></div>
          <div className="md:col-span-3"><F label="🏥 لوكيشن الوجهة (لينك جوجل ماب أو إحداثيات)"><Input name="to_map" dir="ltr" placeholder="https://maps.app.goo.gl/…" /></F></div>
        </div>
        {/عودة/.test(trip) && (
          <div className="animate-expand mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
            <div className="mb-2 text-sm font-bold text-violet-800">🔁 الرجوع بالحالة (ذهاب وعودة)</div>
            <Label required>السيارة هتعمل إيه في الوجهة؟</Label>
            <div className="flex flex-wrap gap-2">
              {WAIT_MODES.map((x, i) => (
                <label key={x} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm has-[:checked]:border-violet-500">
                  <input type="radio" name="wait_mode" value={x} defaultChecked={i === 0} />{x}
                </label>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <F label="هيرجع بالحالة فين؟"><Input name="return_loc" placeholder="فارغ = نفس عنوان الاستلام" /></F>
              <F label="لوكيشن مكان الرجوع"><Input name="return_map" dir="ltr" placeholder="https://maps.app.goo.gl/…" /></F>
              <F label="ميعاد الرجوع المتوقع"><Input name="return_time" type="time" dir="ltr" /></F>
            </div>
          </div>
        )}
      </Section>

      <Section title="موعد تقديم الخدمة" tone="rose">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <F label="تاريخ تقديم الخدمة" req><Input name="service_date" type="date" dir="ltr" defaultValue={today} min={today} required /></F>
          <F label="ساعة تقديم الخدمة"><Input name="service_time" type="time" dir="ltr" /></F>
          <div className="md:col-span-3"><F label="تعليقات"><Textarea name="notes" className="min-h-[60px]" /></F></div>
        </div>
        <p className="mt-2 text-xs text-slate-500">🔁 لو المشوار متكرر، اكتب ده في التعليقات، ومنسق الإسعاف يعتمده كحجز متكرر من نظام الإسعاف.</p>
      </Section>

      <div className="sticky bottom-20 z-10 lg:bottom-4 flex justify-end gap-2 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur">
        <Button type="button" variant="ghost" onClick={() => router.back()}>إلغاء</Button>
        <Button type="submit" size="lg" loading={pending}>🚑 إرسال طلب الإسعاف</Button>
      </div>
    </form>
  );
}

const TONES: Record<string, string> = {
  brand: "border-r-brand-500", violet: "border-r-violet-500", amber: "border-r-amber-500",
  emerald: "border-r-emerald-500", sky: "border-r-sky-500", rose: "border-r-rose-500",
};

function Section({ title, tone, children }: { title: string; tone: string; children: React.ReactNode }) {
  return (
    <div className={`card animate-fade-in-up border-r-4 p-5 ${TONES[tone]}`}>
      <h2 className="mb-3 font-bold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function F({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return <div><Label required={req}>{label}</Label>{children}</div>;
}

function YesNo({ name, label }: { name: string; label: string }) {
  const [v, setV] = useState("لا");
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        {["نعم", "لا", "أخرى"].map((o) => (
          <label key={o} className={`cursor-pointer rounded-lg border px-4 py-1.5 text-sm transition ${v === o ? "border-brand-500 bg-brand-50 font-semibold text-brand-800" : "border-slate-200 text-slate-600"}`}>
            <input type="radio" name={name} value={o} checked={v === o} onChange={() => setV(o)} className="sr-only" />{o}
          </label>
        ))}
      </div>
      {v === "أخرى" && <Input name={`${name}_other`} className="mt-2" placeholder="اكتب التفاصيل" />}
    </div>
  );
}
