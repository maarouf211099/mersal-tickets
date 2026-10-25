import Link from "next/link";

// تظهر أيضًا عند محاولة فتح تذكرة لا يملك المستخدم صلاحية الاطلاع عليها
export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <div className="text-5xl">🔒</div>
      <h1 className="mt-4 text-xl font-bold text-slate-900">الصفحة غير موجودة أو لا تملك صلاحية الاطلاع عليها</h1>
      <p className="mt-2 text-sm text-slate-500">لا يطّلع كل فريق إلا على التذاكر المحوَّلة إليه أو التي يتابعها.</p>
      <Link href="/tickets" className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        العودة إلى التذاكر
      </Link>
    </div>
  );
}
