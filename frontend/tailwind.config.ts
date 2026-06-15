import type { Config } from "tailwindcss";

/**
 * SIHADIR dark design system.
 * Syne for display headings, DM Sans for everything else.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        surface: "#13131a",
        surface2: "#1a1a24",
        border: "#222230",
        accent: "#4f8ef7",
        accent2: "#a78bfa",
        text: "#f0f0f5",
        muted: "#6b6b80",
        success: "#34d399",
        error: "#f87171",
        warning: "#fbbf24",
      },
      fontFamily: {
        display: ["Syne", "system-ui", "sans-serif"],
        sans: ["DM Sans", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "8px",
        md: "10px",
        lg: "14px",
        xl: "20px",
        pill: "100px",
      },
      boxShadow: {
        glow: "0 0 30px rgba(79,142,247,0.3)",
        "glow-lg": "0 0 40px rgba(79,142,247,0.5)",
      },
      maxWidth: {
        content: "1200px",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.6s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
