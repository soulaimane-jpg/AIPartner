import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: {
          0: "hsl(var(--surface-0))",
          1: "hsl(var(--surface-1))",
          2: "hsl(var(--surface-2))",
          3: "hsl(var(--surface-3))",
          sunk: "hsl(var(--surface-sunk))",
        },
        line: {
          DEFAULT: "hsl(var(--line))",
          strong: "hsl(var(--line-strong))",
          hairline: "hsl(var(--hairline))",
        },
        ink: "hsl(var(--foreground))",
        subtle: "hsl(var(--subtle))",
        brand: {
          DEFAULT: "hsl(var(--brand-1))",
          1: "hsl(var(--brand-1))",
          2: "hsl(var(--brand-2))",
          3: "hsl(var(--brand-3))",
        },
        magenta: {
          DEFAULT: "hsl(var(--magenta-1))",
          1: "hsl(var(--magenta-1))",
          2: "hsl(var(--magenta-2))",
          glow: "hsl(var(--magenta-glow))",
        },
        // Backwards-compat alias — `--amber-*` now points at magenta.
        amber: {
          DEFAULT: "hsl(var(--amber-1))",
          1: "hsl(var(--amber-1))",
          2: "hsl(var(--amber-2))",
          glow: "hsl(var(--amber-glow))",
        },
        cinema: {
          bg: "hsl(var(--cinema-bg))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
        },
        violet: { accent: "hsl(var(--accent-violet))" },
        teal: { accent: "hsl(var(--accent-teal))" },
        pink: { accent: "hsl(var(--accent-pink))" },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          violet: "hsl(var(--accent-violet))",
          teal: "hsl(var(--accent-teal))",
          pink: "hsl(var(--accent-pink))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-fg))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          foreground: "hsl(var(--danger-fg))",
        },
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
      },
      spacing: {
        sidebar: "var(--sidebar-w)",
        "sidebar-collapsed": "var(--sidebar-w-collapsed)",
        topbar: "var(--topbar-h)",
      },
      boxShadow: {
        "elev-1": "var(--elev-1)",
        "elev-2": "var(--elev-2)",
        "elev-3": "var(--elev-3)",
        "elev-4": "var(--elev-4)",
        "elev-5": "var(--elev-5)",
        "elev-brand": "var(--elev-brand)",
        "elev-amber": "var(--elev-amber)",
        "elev-primary": "var(--elev-primary)",
        hairline: "0 0 0 1px hsl(var(--line))",
        "hairline-strong": "0 0 0 1px hsl(var(--line-strong))",
      },
      fontSize: {
        "display-xl": ["5.5rem",  { lineHeight: "0.95", letterSpacing: "-0.025em", fontWeight: "600" }],  // 88px
        "display-lg": ["4rem",    { lineHeight: "1.0",  letterSpacing: "-0.022em", fontWeight: "600" }],  // 64px
        "display-md": ["2.5rem",  { lineHeight: "1.05", letterSpacing: "-0.018em", fontWeight: "600" }],  // 40px
        "display-sm": ["2rem",    { lineHeight: "1.1",  letterSpacing: "-0.018em", fontWeight: "600" }],  // 32px
        title:        ["1.375rem",{ lineHeight: "1.25", letterSpacing: "-0.01em",  fontWeight: "600" }],  // 22px
        eyebrow:      ["0.78125rem", { lineHeight: "1.4", letterSpacing: "0.14em", fontWeight: "600" }],  // 12.5px
      },
      transitionTimingFunction: {
        "out-quart": "cubic-bezier(0.22, 1, 0.36, 1)",
        "out-expo":  "cubic-bezier(0.16, 1, 0.3, 1)",
        spring:      "cubic-bezier(0.34, 1.56, 0.64, 1)",
        emphasis:    "cubic-bezier(0.2, 0, 0, 1)",
      },
      transitionDuration: {
        100: "100ms",
        120: "120ms",
        160: "160ms",
        180: "180ms",
        240: "240ms",
        280: "280ms",
        360: "360ms",
        450: "450ms",
        600: "600ms",
      },
      fontFamily: {
        sans:    ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono:    ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-22px)" },
        },
        "gradient-pan": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "shimmer-sweep": {
          from: { transform: "translateX(-100%) skewX(-15deg)" },
          to: { transform: "translateX(350%) skewX(-15deg)" },
        },
        "glow-breathe": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.9" },
        },
        "card-rise": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "border-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "marquee-x": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "float-y": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.85)" },
        },
        "caret-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        "float-slow": "float-slow 8s ease-in-out infinite",
        "gradient-pan": "gradient-pan 5s linear infinite",
        "shimmer-sweep": "shimmer-sweep 3.5s ease-in-out infinite",
        "glow-breathe": "glow-breathe 3.5s ease-in-out infinite",
        "card-rise": "card-rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        "border-spin": "border-spin 6s linear infinite",
        rise: "rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "marquee-x": "marquee-x 38s linear infinite",
        "float-y": "float-y 6s ease-in-out infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "caret-blink": "caret-blink 1.1s steps(2) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
