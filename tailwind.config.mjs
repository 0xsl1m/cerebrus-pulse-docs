import starlightPlugin from '@astrojs/starlight-tailwind';

// Cerebrus Pulse — "Signal & Synthesis" Palette (Holy Trinity)
// x402 accent: #3B82F6 (electric blue)  — structured data, HTTP, developer-facing
// ACP accent:  #F59E0B (warm amber)     — AI synthesis, agent commerce, Virtuals
// A2A accent:  #FF1493 (neon pink)      — agent-to-agent, Google A2A protocol
// Background:  #0B0F1A (deep navy)      — refined dark, not pure black

const accent = {
  200: '#93C5FD', // light blue (text on dark, 8.3:1)
  400: '#60A5FA', // medium blue (links, 5.4:1 on #0B0F1A)
  600: '#3B82F6', // brand primary blue
  700: '#2563EB', // pressed/hover state
  900: '#1E3A5F', // deep blue tint
  950: '#0F1D35', // darkest blue
};

const gray = {
  100: '#E8ECF4', // near-white with blue tint (13.5:1 — AAA)
  200: '#CBD5E1', // light (10.2:1 — AAA)
  300: '#94A3B8', // secondary text (5.8:1 — AA)
  400: '#64748B', // muted (3.8:1 — large text only)
  500: '#475569', // subtle decorative text (2.8:1 — decorative only)
  700: '#1E293B', // card borders, elevated surfaces
  800: '#111827', // card backgrounds
  900: '#0B0F1A', // brand background (deep navy)
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        accent,
        gray,
        // x402 color family (blue)
        x402: {
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
        },
        // ACP color family (amber/gold)
        acp: {
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        // A2A color family (neon pink)
        a2a: {
          300: '#FF69B4',
          400: '#FF1493',
          500: '#E0118A',
          600: '#C20078',
        },
        // Semantic colors
        surface: {
          DEFAULT: '#111827',
          elevated: '#1E293B',
          border: '#1E293B',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Sora', 'Outfit', 'system-ui', 'sans-serif'],
        hero: ['Orbitron', 'Sora', 'system-ui', 'sans-serif'],
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
        'gradient-brand': 'linear-gradient(135deg, #3B82F6, #F59E0B)',
        'gradient-x402': 'linear-gradient(135deg, #3B82F6, #60A5FA)',
        'gradient-acp': 'linear-gradient(135deg, #F59E0B, #FBBF24)',
        'gradient-a2a': 'linear-gradient(135deg, #FF1493, #FF69B4)',
        'gradient-dual': 'linear-gradient(135deg, #60A5FA, #FBBF24)',
        'gradient-trinity': 'linear-gradient(135deg, #60A5FA, #A78BFA, #FF1493, #FBBF24)',
      },
    },
  },
  plugins: [starlightPlugin()],
};
