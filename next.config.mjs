/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone = نسخة تشغيل مستقلة بتتنسخ لفولدر النشر (scripts/deploy.mjs)
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // المرفقات بتترفع مع فورم التيكت — 10 ميجا للملف، 5 ملفات كحد أقصى
    serverActions: { bodySizeLimit: "55mb" },
  },
  serverExternalPackages: ["bcryptjs"],
};
export default nextConfig;
