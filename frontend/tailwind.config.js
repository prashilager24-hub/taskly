import { heroui } from "@heroui/theme"

// TapMind design system (TapMind-UI-Design-System.md) — Taskly keeps Poppins as its only font.
// Colors, radius, shadows, tracking and motion are the TapMind values. HeroUI's semantic
// tokens (primary / default / danger / success) are mapped onto the same scales below, so
// HeroUI components and `text-default-500`-style classes pick the theme up automatically.

const brand = {
  50: "#fff4ec", 100: "#ffe3cf", 200: "#ffc59c", 300: "#ffa06b", 400: "#ff8442",
  500: "#ff7a30", 600: "#ff6a1f", 700: "#e85511", 800: "#b8430f", 900: "#8f3510", 950: "#4d1b08",
}
const ink = {
  50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#8a8a8a", 450: "#5f5f5f",
  500: "#6a6a6a", 600: "#52525b", 700: "#3f3f46", 800: "#141414", 900: "#0b0b0b", 950: "#000000",
}
const rose = {
  50: "#fff1ee", 100: "#ffe0d9", 200: "#ffc3b3", 300: "#ff9d85", 400: "#ff7a5c",
  500: "#ff6040", 600: "#ff4b2b", 700: "#e33115", 800: "#b52710", 900: "#8f2010", 950: "#4d0f08",
}
// Tailwind's stock emerald — TapMind uses it for success
const emerald = {
  50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7", 400: "#34d399",
  500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46", 900: "#064e3b",
}

// HeroUI scales take 50–900 + DEFAULT + foreground
const heroScale = (scale, def, foreground) => {
  const { 450: _skip, 950: _skip2, ...rest } = scale
  return { ...rest, DEFAULT: def, foreground }
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    './src/layouts/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Replaced, not extended: every corner is square; `rounded-full` stays for circles
    borderRadius: {
      none: "0px", sm: "0px", DEFAULT: "0px", md: "0px", lg: "0px",
      xl: "0px", "2xl": "0px", "3xl": "0px", full: "9999px",
    },
    fontFamily: {
      sans: ["Poppins", "system-ui", "-apple-system", "sans-serif"],
      primary: ["Poppins", "system-ui", "-apple-system", "sans-serif"],
      // TapMind's secondary (labels, eyebrows, IDs) — Poppins here, styled by tracking + uppercase
      secondary: ["Poppins", "system-ui", "-apple-system", "sans-serif"],
    },
    extend: {
      colors: { brand, ink, rose, emerald },
      fontWeight: {
        regular: "400",
        medium: "600",
        bold: "800",
        black: "900",
      },
      letterSpacing: {
        display: "-.045em",
        title: "-.035em",
        tight: "-.02em",
        btn: ".14em",
        label: ".2em",
        eyebrow: ".22em",
        chip: ".14em",
        pw: ".24em",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(9, 9, 11, 0.06), 0 1px 3px 0 rgba(9, 9, 11, 0.08)",
        pop: "0 10px 30px -8px rgba(9, 9, 11, 0.35)",
      },
      keyframes: {
        shine: {
          '0%': { left: '-100%' },
          '50%': { left: '150%' },
          '100%': { left: '150%' },
        },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        fadeInUp: { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        blobFloat: { "0%, 100%": { transform: "translate(0, 0) scale(1)" }, "50%": { transform: "translate(3%, -4%) scale(1.05)" } },
        glowPulse: { "0%, 100%": { opacity: ".18" }, "50%": { opacity: ".34" } },
        scanline: { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100%)" } },
        blink: { "0%, 49%": { opacity: "1" }, "50%, 100%": { opacity: "0" } },
      },
      animation: {
        shine: 'shine 2.5s ease-in-out infinite',
        "fade-in": "fadeIn .4s ease-out both",
        "fade-in-up": "fadeInUp .5s ease-out both",
        "blob-float": "blobFloat 12s ease-in-out infinite",
        "glow-pulse": "glowPulse 9s ease-in-out infinite",
        scanline: "scanline 11s linear infinite",
        blink: "blink 1.2s step-end infinite",
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      layout: {
        radius: { small: "0px", medium: "0px", large: "0px" },
        borderWidth: { small: "1px", medium: "1px", large: "2px" },
      },
      themes: {
        light: {
          colors: {
            background: "#fafafa",
            foreground: ink[900],
            primary: heroScale(brand, brand[600], "#ffffff"),
            default: heroScale(ink, ink[200], ink[900]),
            danger: heroScale(rose, rose[600], "#ffffff"),
            success: heroScale(emerald, emerald[600], "#ffffff"),
            focus: brand[400],
          },
        },
        dark: {
          colors: {
            background: ink[950],
            foreground: "#ffffff",
            primary: heroScale(brand, brand[600], "#ffffff"),
            danger: heroScale(rose, rose[600], "#ffffff"),
            success: heroScale(emerald, emerald[600], "#ffffff"),
            focus: brand[400],
          },
        },
      },
    }),
  ],
}
