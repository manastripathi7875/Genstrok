/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        protera: {
          900: "#0f1724",
          700: "#111827",
          500: "#374151",
          300: "#9ca3af",
        },
      },
    },
  },
  plugins: [],
};
