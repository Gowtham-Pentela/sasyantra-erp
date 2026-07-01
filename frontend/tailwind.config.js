/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef4ff', 100: '#d9e6ff', 200: '#bcd3ff', 300: '#8eb6ff',
          400: '#598dff', 500: '#3366ff', 600: '#1f4ae6', 700: '#1a3bbf',
          800: '#1c3399', 900: '#1d2f7a', 950: '#131d4a',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        float: '0 10px 30px -12px rgba(0,0,0,0.25)',
      },
      borderRadius: { xl2: '1.25rem' },
      keyframes: {
        fadein: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: { fadein: 'fadein .25s ease-out' },
    },
  },
  plugins: [],
};