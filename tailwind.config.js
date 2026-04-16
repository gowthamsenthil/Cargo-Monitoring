/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#F5F0E8',   // very light sand
          100: '#F0EAE0',   // light sand
          200: '#E0D0BB',   // medium sand
          300: '#E7D7C1',   // sand — sidebar active text (readable on dark green)
          400: '#D4C4AE',   // darker sand — sidebar icons
          500: '#278C55',   // brighter green — hover for buttons on white cards
          600: '#1F6F4A',   // primary green — CTAs, buttons (on white cards)
          700: '#175A3C',   // dark green — sidebar bg, pressed
          800: '#0F3D29',   // deeper green
          900: '#092D1E',   // very dark green
          950: '#051A12',   // darkest
        },
        green: {
          400: '#4ADE80',   // bright green — success/live/low-risk on dark green bg
          500: '#22C55E',   // medium bright green
        },
      },
    },
  },
  plugins: [],
}
