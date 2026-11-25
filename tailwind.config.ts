import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--cc-paper) / <alpha-value>)',
        surface: 'rgb(var(--cc-surface) / <alpha-value>)',
        ink: 'rgb(var(--cc-ink) / <alpha-value>)',
        mute: 'rgb(var(--cc-mute) / <alpha-value>)',
        line: 'rgb(var(--cc-line) / <alpha-value>)',
        cobalt: 'rgb(var(--cc-cobalt) / <alpha-value>)',
        add: 'rgb(var(--cc-add) / <alpha-value>)',
        drop: 'rgb(var(--cc-drop) / <alpha-value>)',
        shift: 'rgb(var(--cc-shift) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
