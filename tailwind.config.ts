import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
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
      fontFamily: {
        // "saudi_riyal" trails every stack (unicode-range U+20C1 only) so the
        // new riyal symbol renders in SAR amounts without affecting any other
        // glyph. See the @font-face in index.css.
        sans: ["IBM Plex Sans Arabic", "Cairo", "-apple-system", "Helvetica", "Arial", "sans-serif", "saudi_riyal"],
        brand: ["Reem Kufi", "Tajawal", "system-ui", "sans-serif", "saudi_riyal"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace", "saudi_riyal"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        /* Souq extended palette — exposed as Tailwind colors so new
           component code can write `bg-navy`, `text-saffron`, etc.
           directly. Existing shadcn tokens above stay so the 68 pages
           that use `bg-primary`/`text-foreground` etc. keep working. */
        navy: {
          DEFAULT: "hsl(var(--navy))",
          700: "hsl(var(--navy-700))",
          900: "hsl(var(--navy-900))",
        },
        saffron: {
          DEFAULT: "hsl(var(--saffron))",
          600: "hsl(var(--saffron-600))",
          100: "hsl(var(--saffron-100))",
        },
        terracotta: "hsl(var(--terracotta))",
        sage: "hsl(var(--sage))",
        cream: "hsl(var(--cream))",
        ink: {
          DEFAULT: "hsl(var(--ink))",
          soft: "hsl(var(--ink-soft))",
          faint: "hsl(var(--ink-faint))",
        },
        surface: {
          DEFAULT: "hsl(var(--background))",
          2: "hsl(var(--surface-2))",
          3: "hsl(var(--surface-3))",
        },
      },
      borderRadius: {
        /* Chunky / tactile radii — base 16px now (was 10px). The shadcn
           scale (sm/md/lg/xl/2xl) is preserved but every step is bigger,
           so existing `rounded-xl` etc. usage instantly gets the Souq
           feel without touching consumer code. */
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        /* Souq feature-panel radius (26px) — for hero panels, big CTAs. */
        souq: "1.625rem",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
        "depth-navy": "var(--shadow-depth-navy)",
        "depth-saffron": "var(--shadow-depth-saffron)",
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
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.4s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
