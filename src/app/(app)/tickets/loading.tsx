// هيكل قائمة التذاكر لحد ما البيانات توصل
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="جاري التحميل">
      <div className="flex items-end justify-between">
        <div className="space-y-2"><div className="skeleton h-8 w-40" /><div className="skeleton h-4 w-24" /></div>
        <div className="skeleton h-10 w-36 rounded-xl" />
      </div>
      <div className="flex gap-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-9 w-28 rounded-full" />)}</div>
      <div className="skeleton h-[74px] rounded-2xl" />
      <div className="card divide-y divide-slate-100">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-6 px-4 py-4">
            <div className="flex-1 space-y-2"><div className="skeleton h-4 w-40" /><div className="skeleton h-3 w-24" /></div>
            <div className="skeleton h-6 w-20 rounded-full" /><div className="skeleton h-6 w-28 rounded-full" />
            <div className="skeleton h-6 w-16 rounded-full" /><div className="skeleton h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
