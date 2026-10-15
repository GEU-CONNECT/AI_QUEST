/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'Outfit', 'Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        geu: {
          navy: '#1c1f58',
          royal: '#252975',
          gold: '#c59a3f',
          accent: '#e67e22'
        }
      }
    },
  },
  plugins: [],
}
