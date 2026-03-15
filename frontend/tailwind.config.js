/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ASU Maroon / Gold accents
        maroon: {
          DEFAULT: '#8C1D40',
          light: '#a8294f',
          dark: '#6e1632',
        },
        gold: {
          DEFAULT: '#FFC627',
          light: '#ffd35c',
          dark: '#d4a31f',
        },
        // Dark theme surface colors
        surface: {
          DEFAULT: '#1c1c1e',
          light: '#2c2c2e',
          dark: '#09090b',
        },
      },
    },
  },
  plugins: [],
}
