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
        'scale-in': 'scaleIn 0.3s ease-out both',
        'scale-out': 'scaleOut 0.3s ease-in both',
        'slide-in-left': 'slideInLeft 0.35s ease-out both',
        'slide-in-down': 'slideInDown 0.35s ease-out both',
        'bounce-in': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) both',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-subtle': 'bounceSubtle 2s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'swing': 'swing 1.5s ease-in-out infinite',
        'rotate-in': 'rotateIn 0.5s ease-out both',
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
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.95)' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        rotateIn: {
          '0%': { opacity: '0', transform: 'rotate(-10deg) scale(0.9)' },
          '100%': { opacity: '1', transform: 'rotate(0) scale(1)' },
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
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        glowPulse: {
          '0%, 100%': { 
            boxShadow: '0 0 15px rgba(20, 82, 255, 0.2), 0 0 30px rgba(20, 82, 255, 0.1)' 
          },
          '50%': { 
            boxShadow: '0 0 25px rgba(20, 82, 255, 0.4), 0 0 50px rgba(20, 82, 255, 0.2)' 
          },
        },
        swing: {
          '20%': { transform: 'rotate(15deg)' },
          '40%': { transform: 'rotate(-10deg)' },
          '60%': { transform: 'rotate(5deg)' },
          '80%': { transform: 'rotate(-5deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
      },
    },
  },
  plugins: []
}
