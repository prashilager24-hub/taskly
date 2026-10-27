import { heroui } from "@heroui/theme"

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
    extend: {
      keyframes: {
        shine: {
          '0%': { left: '-100%' },
          '50%': { left: '150%' },
          '100%': { left: '150%' },
        },
      },
      animation: {
        shine: 'shine 2.5s ease-in-out infinite',
      },
      colors: {
        primary: {
          50: '#FFF2E5',
          100: '#FFD8B3',
          200: '#FFBD80',
          300: '#FFA24D',
          400: '#FE5F00', // your main color
          500: '#E65400',
          600: '#CC4A00',
          700: '#B34000',
          800: '#993600',
          900: '#802C00',
          DEFAULT: '#FE5F00',
          foreground: '#FFFFFF',
        },
        secondary: "#9b94ffff",
        danger: "#FF3232",
        success: "#4CAF50",
        neutral: "#F3F4F6",
      },
      fontFamily: {
        'sans': ['Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
      },
    },
  },
  darkMode: "class",
  plugins: [heroui()],
}
