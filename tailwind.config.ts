import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          blue:   '#0080C9',
          teal:   '#69C0AC',
          cyan:   '#5FC4E1',
          yellow: '#F9D900',
        },
        // Override gray-50 to MTIP brand page background
        gray: {
          50: '#EBF1F6',
        },
      },
    },
  },
  plugins: [],
};

export default config;
