// بيظهر لحد ما بيانات الصفحة توصل من السيرفر
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="جاري التحميل">
      <div className="skeleton h-8 w-56" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
      </div>
      <div className="card space-y-3 p-5">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-10" />)}
      </div>
    </div>
  );
}
