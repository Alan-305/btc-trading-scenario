/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f172a",
          card: "#1e293b",
          border: "#334155",
        },
        accent: {
          green: "#22c55e",
          red: "#ef4444",
          blue: "#3b82f6",
          amber: "#f59e0b",
        },
      },
      fontFamily: {
        english: ['"Century Gothic"', "Century", "serif"],
        japanese: ['"Hiragino Mincho ProN"', '"Yu Mincho"', "serif"],
      },
    },
  },
  plugins: [],
};
