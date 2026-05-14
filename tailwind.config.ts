import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,jsx,ts,tsx,mdx}',
    './components/**/*.{js,jsx,ts,tsx,mdx}',
    './contexts/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // CSS-variable-driven brand tokens. See app/globals.css for the
        // values and the [data-locale='ca'] override that switches the
        // accent from blue (US) to Canadian red (CA).
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          strong: 'rgb(var(--brand-strong) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
          tint: 'rgb(var(--brand-tint) / <alpha-value>)',
          on: 'rgb(var(--brand-on) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
