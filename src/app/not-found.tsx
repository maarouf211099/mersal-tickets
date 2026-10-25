import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">الصفحة غير موجودة</h1>
      <Link href="/dashboard" className="mt-4 text-sm font-semibold text-brand-700 hover:underline">العودة إلى الرئيسية</Link>
    </div>
  );
}
