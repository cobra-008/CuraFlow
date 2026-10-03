/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary navy
        navy: {
          950: '#0d1625',
          900: '#1a2744',
          800: '#1e3260',
          700: '#24407a',
          600: '#2c5099',
          500: '#3b63b8',
          400: '#5c82cc',
        },
        // Warm neutrals (for sidebar bg)
        warm: {
          50:  '#faf8f3',
          100: '#f5f0e8',
          200: '#ede6d8',
          300: '#e0d5c0',
          400: '#cdbfa0',
          500: '#b89a6a',
          600: '#9c7f50',
          700: '#7d6338',
          800: '#5e4920',
          900: '#3d2e0d',
        },
        // Clinical status colors
        clinical: {
          critical: '#dc2626',
          elevated: '#ea580c',
          normal:   '#16a34a',
          warning:  '#d97706',
          info:     '#1e50a0',
        },
      },
      fontFamily: {
        sans: ['"Times New Roman"', 'Times', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '16px' }],
        xs:    ['13px', { lineHeight: '18px' }],
        sm:    ['15px', { lineHeight: '22px' }],
        base:  ['16px', { lineHeight: '24px' }],
        lg:    ['18px', { lineHeight: '26px' }],
        xl:    ['20px', { lineHeight: '28px' }],
        '2xl': ['20px', { lineHeight: '28px' }],
        '3xl': ['24px', { lineHeight: '32px' }],
        '4xl': ['28px', { lineHeight: '36px' }],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.07), 0 1px 8px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)',
        sidebar: '2px 0 16px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        'card': '12px',
        'pill': '100px',
      },
    },
  },
  plugins: [],
}
