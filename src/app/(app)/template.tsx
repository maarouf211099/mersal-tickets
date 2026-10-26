// template (مش layout) علشان يتعمله mount من جديد مع كل صفحة، فحركة الدخول تشتغل في كل تنقل
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
