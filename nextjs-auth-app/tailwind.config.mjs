/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        ubuntu: {
          50: '#fef2e8',
          100: '#fde0c8',
          200: '#fbc195',
          300: '#f99d5c',
          400: '#f77a2e',
          500: '#E95420',
          600: '#d44917',
          700: '#b33d12',
          800: '#8c2f0e',
          900: '#66220a',
        },
        aubergine: {
          50: '#f5f0f6',
          100: '#e6dae8',
          200: '#cdb5d2',
          300: '#ae8bb6',
          400: '#8f619a',
          500: '#772953',
          600: '#5e2142',
          700: '#4a1a35',
          800: '#361326',
          900: '#240d19',
        },
      },
      fontFamily: {
        ubuntu: ['Ubuntu', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
