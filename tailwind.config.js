/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F3EBDD',
        paper: '#FFFDF4',
        ink: '#4A4034',
        muted: '#746959',
        line: '#D7C9AD',
        forest: {
          50: '#EDF6EA',
          100: '#DCECD7',
          300: '#A4C79F',
          500: '#668F6B',
          600: '#527A5A',
          700: '#41664D',
          800: '#32513D',
          900: '#253C2F',
        },
        earth: {
          50: '#FBF4E6',
          100: '#F1E3C7',
          300: '#DFC28B',
          500: '#AD7B43',
          700: '#72502F',
        },
        clay: {
          100: '#F7E9E3',
          300: '#DFC0B4',
          500: '#B97863',
          700: '#925542',
          800: '#704032',
        },
        category: {
          sight: '#5C8765',
          food: '#A87545',
          transport: '#577A6E',
          hotel: '#76674F',
        },
      },
      fontFamily: {
        rounded: [
          'Yu Gothic UI',
          'Hiragino Maru Gothic ProN',
          'Arial Rounded MT Bold',
          'Noto Sans TC',
          'PingFang TC',
          'Meiryo',
          'Microsoft JhengHei',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '2rem',
        '4xl': '2.75rem',
      },
      boxShadow: {
        soft: '0 5px 0 #D4C5A8, 0 14px 28px rgba(74, 64, 52, 0.10)',
        'soft-sm': '0 3px 0 #D4C5A8, 0 8px 16px rgba(74, 64, 52, 0.10)',
        float: '0 8px 0 #C6B594, 0 28px 64px rgba(65, 54, 39, 0.22)',
        nav: '0 5px 0 #CABA99, 0 18px 34px rgba(65, 54, 39, 0.18)',
      },
      backgroundImage: {
        'paper-dots':
          'radial-gradient(circle, rgba(65, 102, 77, 0.15) 1px, transparent 1px)',
        'paper-grid':
          'linear-gradient(rgba(65, 102, 77, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(65, 102, 77, 0.06) 1px, transparent 1px)',
      },
      backgroundSize: {
        dots: '18px 18px',
        grid: '24px 24px',
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
      minHeight: {
        tap: '2.75rem',
      },
      transitionTimingFunction: {
        bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.99)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 280ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
