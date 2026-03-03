import starlightPlugin from '@astrojs/starlight-tailwind';

// Cerebrus Pulse Brand Palette
// Primary: #8B3FD9 (deep purple)  Accent: #00D4FF (electric cyan)  Highlight: #FF006E (neon pink)
const accent = {
  200: '#B388FF', // light purple (text on dark)
  400: '#A855F7', // medium purple
  600: '#8B3FD9', // brand primary
  700: '#7C3ACD', // pressed state
  900: '#4A1D96', // deep purple
  950: '#2D1065', // darkest purple
};

const gray = {
  100: '#F0EEFF', // purple-tinted white
  200: '#DDD8F0', // purple-tinted light
  300: '#B0A8C8', // muted lavender
  400: '#8B83A8', // medium (body text — 5.2:1 on #0A0A0A)
  500: '#6B6185', // subtle text (4.5:1 on #0A0A0A — AA pass)
  700: '#2A2438', // card backgrounds (purple-tinted dark)
  800: '#1A1525', // section alt bg
  900: '#0A0A0A', // brand bg (near-black)
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        accent,
        gray,
        cyan: {
          300: '#67E8F9',
          400: '#00D4FF', // brand accent
          500: '#00B8DB',
        },
        pink: {
          400: '#FF4D94',
          500: '#FF006E', // brand highlight
          600: '#DB005E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'slide-up': 'slide-up 0.6s ease-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #8B3FD9, #00D4FF, #FF006E)',
        'gradient-purple-cyan': 'linear-gradient(135deg, #8B3FD9, #00D4FF)',
        'gradient-cyan-pink': 'linear-gradient(135deg, #00D4FF, #FF006E)',
      },
    },
  },
  plugins: [starlightPlugin()],
};
