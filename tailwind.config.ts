import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", md: "2rem", lg: "3rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        border: "rgb(var(--border) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        input: "rgb(var(--border) / <alpha-value>)",
        ring: "rgb(var(--accent) / <alpha-value>)",
        elevated: "rgb(var(--elevated) / <alpha-value>)",
        chart: {
          1: "rgb(var(--chart-1) / <alpha-value>)",
          2: "rgb(var(--chart-2) / <alpha-value>)",
          3: "rgb(var(--chart-3) / <alpha-value>)",
          4: "rgb(var(--chart-4) / <alpha-value>)",
          5: "rgb(var(--chart-5) / <alpha-value>)",
        },
        risk: {
          low: "rgb(var(--risk-low) / <alpha-value>)",
          medium: "rgb(var(--risk-medium) / <alpha-value>)",
          high: "rgb(var(--risk-high) / <alpha-value>)",
          critical: "rgb(var(--risk-critical) / <alpha-value>)",
        },
        ink: "rgb(var(--foreground) / <alpha-value>)",
        surface: "rgb(var(--card) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(3.25rem, 7vw, 6rem)", { lineHeight: "0.94", letterSpacing: "-0.05em" }],
        "display-lg": ["clamp(2.5rem, 5vw, 4rem)", { lineHeight: "0.98", letterSpacing: "-0.045em" }],
        "display-md": ["clamp(1.875rem, 3.5vw, 2.75rem)", { lineHeight: "1.04", letterSpacing: "-0.035em" }],
      },
      borderRadius: {
        card: "12px",
        panel: "14px",
        tile: "11px",
        hero: "18px",
        pill: "999px",
      },
      spacing: {
        section: "6rem",
        "section-sm": "3rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(20 21 26 / 0.04), 0 12px 32px -16px rgb(20 21 26 / 0.18)",
        lift: "0 2px 4px rgb(20 21 26 / 0.05), 0 20px 40px -20px rgb(20 21 26 / 0.28)",
        inset: "inset 0 0 0 1px rgb(var(--border) / 0.6)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        "radar-sweep": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        flash: {
          "0%": { backgroundColor: "rgb(var(--accent) / 0.28)" },
          "100%": { backgroundColor: "transparent" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 500ms ease-out both",
        "slide-in": "slide-in 320ms ease-out both",
        marquee: "marquee 32s linear infinite",
        "pulse-soft": "pulseSoft 1.8s ease-in-out infinite",
        flash: "flash 2.4s ease-out both",
        "radar-sweep": "radar-sweep 4.5s linear infinite",
        "accordion-down": "accordion-down 200ms ease-out",
        "accordion-up": "accordion-up 200ms ease-out",
      },
      transitionDuration: { 400: "400ms" },
    },
  },
  plugins: [animate],
};

export default config;
