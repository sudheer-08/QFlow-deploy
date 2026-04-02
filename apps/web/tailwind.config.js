/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        qf: {
          bg: '#f3f6ff',
          surface: '#ffffff',
          'text-1': '#11142f',
          'text-2': '#5f6c97',
          'text-3': '#8a95b7',
          border: '#d8dff7',
          primary: '#1452ff',
          'primary-strong': '#0f4df5',
          accent: '#00b48d',
          success: '#128a63',
          warning: '#b6720a',
          danger: '#be2845',
        }
      },
      borderRadius: {
        'qf-sm': '10px',
        'qf-md': '14px',
        'qf-lg': '20px',
        'qf-xl': '24px',
      },
      boxShadow: {
        'qf-1': '0 10px 24px rgba(18, 84, 255, 0.14)',
        'qf-2': '0 18px 38px rgba(19, 27, 63, 0.12)',
        'qf-3': '0 22px 54px rgba(17, 20, 47, 0.14)',
        'qf-glow': '0 0 40px rgba(20, 82, 255, 0.15)',
      },
      fontFamily: {
        display: ['Sora', 'Manrope', 'sans-serif'],
        body: ['Manrope', 'Segoe UI', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.4s ease-out both',
        'fade-in': 'fadeIn 0.3s ease-out both',
        'slide-in-right': 'slideInRight 0.35s ease-out both',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 1.6s linear infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(20, 82, 255, 0.15)' },
          '50%': { boxShadow: '0 0 40px rgba(20, 82, 255, 0.3)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
    },
  },
  plugins: []
}
