import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مرسال - نظام التذاكر",
  description: "نظام التذاكر لمؤسسة مرسال",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
