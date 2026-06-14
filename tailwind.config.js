/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/client/index.html', './src/client/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Black-and-white programmer base with a single blueprint-blue accent.
        bg: '#0a0b0d',
        canvas: '#0c0e11',
        node: '#121419',
        'node-expanded': '#15181e',
        accent: '#5ea9ff', // blueprint blue — used only for technical elements
        success: '#5fb98a',
        warning: '#d6a14f',
        'text-primary': '#e6e8eb',
        'text-muted': '#7d8590',
        grid: '#1b2530', // faint blueprint grid line
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Subtle blueprint-blue edge, not a neon glow.
        glow: '0 0 0 1px rgba(94, 169, 255, 0.25)',
        'glow-strong': '0 0 0 1px rgba(94, 169, 255, 0.6), 0 0 16px rgba(94, 169, 255, 0.12)',
      },
      keyframes: {
        'fade-scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-accent': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(94, 169, 255, 0.5)' },
          '50%': { boxShadow: '0 0 0 8px rgba(94, 169, 255, 0)' },
        },
      },
      animation: {
        'fade-scale-in': 'fade-scale-in 0.25s ease-out',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'pulse-accent': 'pulse-accent 2s infinite',
      },
    },
  },
  plugins: [],
};
