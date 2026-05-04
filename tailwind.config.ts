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
          space:  '#154194',
          blue:   '#0080C8',
          teal:   '#69BFAC',
          cyan:   '#5FC3E1',
          yellow: '#F9D900',
        },
        // Override gray-50 to MTIP official page background
        gray: {
          50: '#D9E4EB',
        },
      },
    },
  },
  plugins: [],
};

export default config;
