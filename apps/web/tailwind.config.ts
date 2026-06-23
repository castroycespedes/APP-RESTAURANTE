import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      borderRadius: {
        app: 'var(--radius-md)'
      },
      colors: {
        app: {
          accent: 'var(--color-accent)',
          background: 'var(--color-background)',
          border: 'var(--color-border)',
          button: 'var(--color-button)',
          muted: 'var(--color-muted)',
          primary: 'var(--color-primary)',
          surface: 'var(--color-surface)',
          text: 'var(--color-text)'
        }
      }
    }
  }
};

export default config;
