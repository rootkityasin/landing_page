/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.{html,js}",
    "./database.js",
    "./server.js"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          crimson: '#D92143',
          crimsonDark: '#BF1A37',
          orange: '#F69D39',
          gold: '#E0C375',
          cream: '#FEF5E4',
          bgLight: '#FCFAF6',
          dark: '#0F172A',
          stone: '#334155'
        },
        primary: {
          50: '#ecfdf5',
          500: '#10b981',
          600: '#059669',
          700: '#047857'
        }
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'glow-red': '0 10px 25px -3px rgba(217, 33, 67, 0.4)',
        'glow-orange': '0 10px 25px -3px rgba(246, 157, 57, 0.35)',
        'luxury': '0 20px 40px -15px rgba(15, 23, 42, 0.07)'
      }
    },
  },
  plugins: [],
}
