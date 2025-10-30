
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#2e90ff', light: '#5aa7ff', dark: '#1e73e6' },
        accent: { DEFAULT: '#ff8a3d', dark: '#e56f1f' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 30px rgba(0,0,0,0.06)',
      },
      backgroundImage: {
        grid: 'linear-gradient(to right, rgba(15,23,42,.04) 1px, transparent 1px),linear-gradient(to bottom, rgba(15,23,42,.04) 1px, transparent 1px)',
      }
    },
  },
  plugins: [],
} satisfies Config
