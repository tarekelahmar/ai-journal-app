/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        journal: {
          bg: '#FAF8F5',
          surface: '#FFFFFF',
          'surface-alt': '#F5F0EB',
          accent: '#C4704B',
          'accent-hover': '#B3603D',
          'accent-light': '#F0DDD4',
          positive: '#7A8F6B',
          'positive-light': '#E8EDE4',
          negative: '#C47A6B',
          'negative-light': '#F5E4E0',
          amber: '#C4A04B',
          'amber-light': '#F5EFE0',
          text: '#2C2C2C',
          'text-secondary': '#6B6B6B',
          'text-muted': '#9B9B9B',
          border: '#E8E4E0',
          'border-light': '#F0EDE8',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      },
    },
  },
  plugins: [],
}
