import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Cairo", "system-ui", "sans-serif"],
      },
      colors: {
        // اللون الرئيسي: تركوازي مرسال (Teal)
        brand: {
          50:  "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",  // اللون الأساسي - مطابق للوجو
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        // اللون الثانوي: ذهبي (Gold/Amber) — من الجزء العربي في اللوجو
        accent: {
          50:  "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f0b429",  // اللون الأساسي - قريب من الذهبي في اللوجو
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
