import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        'card-hover': 'rgb(var(--card-hover) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        primary: {
          DEFAULT: '#4f46e5',
          hover: '#4338ca',
          light: '#6366f1',
        },
        accent: '#f59e0b',
        status: {
          unread: '#3b82f6',
          reading: '#10b981',
          read: '#6b7280',
          waiting: '#f59e0b',
          paused: '#64748b',
          dropped: '#374151',
        },
      },
    },
  },
  plugins: [],
};

export default config;
