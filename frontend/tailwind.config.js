/** @type {import('tailwindcss').Config} */
// Tokens mirror src/design-system.js — keep the two files in sync.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:        "#0a0a0f",
        surface1:  "#13131a",
        surface2:  "#1c1c26",
        surface3:  "#242432",
        primary:   { DEFAULT: "#7c3aed", hover: "#6d28d9" },
        success:   "#10b981",
        warning:   "#f59e0b",
      },
      borderColor: {
        subtle: "rgba(255,255,255,0.06)",
        strong: "rgba(255,255,255,0.12)",
      },
      borderRadius: {
        card: "16px",
        btn: "14px",
        sheet: "24px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.2)",
        glow: "0 0 20px rgba(124,58,237,0.3)",
      },
    },
  },
  plugins: [],
};
