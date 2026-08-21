/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // JKOMS Global Ltd rebrand palette (from Corporate Identity Guide)
        jkoms: {
          navy: '#002062',      // primary — headers, wordmark, nav rail
          navyDark: '#001440',  // pressed states, deep panels
          steel: '#4F79A7',     // secondary accent — links, active states
          silver: '#C0C0C0',    // globe metallic — dividers, muted icons
          white: '#FFFFFF'
        },
        status: {
          pending: '#C0C0C0',
          transit: '#4F79A7',
          delivered: '#1F8A4C',
          exception: '#C0392B',
          returned: '#B7791F'
        }
      },
      fontFamily: {
        display: ['"Archivo Black"', '"Archivo"', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        panel: '0 1px 2px 0 rgba(0, 32, 98, 0.06), 0 1px 3px 0 rgba(0, 32, 98, 0.10)'
      }
    }
  },
  plugins: []
};
