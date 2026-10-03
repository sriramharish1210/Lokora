/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        lokora: {
          navy: '#0f172a',
          charcoal: '#1e293b',
          cream: '#faf7f2',
          warm: '#f5f0e8',
          muted: '#f8f9fa',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(165deg, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.4) 50%, rgba(15,23,42,0.7) 100%)',
        'card-gradient': 'linear-gradient(180deg, transparent 40%, rgba(15,23,42,0.85) 100%)',
        'orange-glow': 'radial-gradient(ellipse at center, rgba(234,88,12,0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'glow-orange': '0 0 30px rgba(234, 88, 12, 0.15)',
        'card-hover': '0 20px 60px -12px rgba(15, 23, 42, 0.18)',
        'nav': '0 1px 40px rgba(15, 23, 42, 0.08)',
        'search': '0 8px 40px rgba(15, 23, 42, 0.12)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
