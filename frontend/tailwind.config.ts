import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#080812",
        panel: "#0c0c1e",
        "panel-elevated": "#11112a",
        border: {
          DEFAULT: "rgba(255,255,255,0.06)",
          glow: "rgba(0,245,255,0.2)",
          "glow-purple": "rgba(168,85,247,0.2)",
        },
        cyan: {
          neon: "#00f5ff",
          soft: "#67e8f9",
          dim: "rgba(0,245,255,0.15)",
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
        },
        purple: {
          neon: "#a855f7",
          deep: "#7c3aed",
          dim: "rgba(168,85,247,0.15)",
          50: "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a855f7",
          600: "#9333ea",
          700: "#7c3aed",
          800: "#6b21a8",
          900: "#581c87",
        },
        metric: {
          stress: "#ff4757",
          focus: "#00f5ff",
          fatigue: "#a855f7",
          burnout: "#f97316",
          readiness: "#22c55e",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-orbitron)", "monospace"],
        mono: ["var(--font-space)", "monospace"],
      },
      animation: {
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "pulse-glow-purple": "pulseGlowPurple 2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "scan": "scan 4s linear infinite",
        "wave": "wave 3s ease-in-out infinite",
        "count-up": "countUp 0.5s ease-out forwards",
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0,245,255,0.2), 0 0 40px rgba(0,245,255,0.05)" },
          "50%": { boxShadow: "0 0 30px rgba(0,245,255,0.4), 0 0 60px rgba(0,245,255,0.15)" },
        },
        pulseGlowPurple: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(168,85,247,0.2), 0 0 40px rgba(168,85,247,0.05)" },
          "50%": { boxShadow: "0 0 30px rgba(168,85,247,0.4), 0 0 60px rgba(168,85,247,0.15)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(1.5)" },
        },
        countUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "glow-cyan": "0 0 20px rgba(0,245,255,0.3)",
        "glow-purple": "0 0 20px rgba(168,85,247,0.3)",
        "glow-red": "0 0 20px rgba(255,71,87,0.3)",
        "glow-orange": "0 0 20px rgba(249,115,22,0.3)",
        "glow-green": "0 0 20px rgba(34,197,94,0.3)",
        "panel": "0 4px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
