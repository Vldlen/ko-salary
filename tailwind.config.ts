import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F2F7FF',   // Небесная роса — фон
          100: '#DEE7F5',  // Голубая дымка — вторичный фон
          200: '#B8D4FF',  // light accent
          300: '#009DFF',  // Электрический синий
          400: '#004AFF',  // Неоновый синий — основной
          500: '#004AFF',  // alias основного
          600: '#0020DD',  // Синий океан
          700: '#0020DD',  // alias
          800: '#33058D',  // Глубокий Индиго
          900: '#242424',  // Угольный черный
        },
        accent: {
          DEFAULT: '#FF6D2E', // Яркий оранжевый
          light: '#FFF0E8',
          dark: '#E55A1B',
        }
      },
      fontFamily: {
        heading: ['var(--font-unbounded)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
