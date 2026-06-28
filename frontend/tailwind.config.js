/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#000000",
          card: "#0a0a0a",
          border: "#2a2a2a",
          elevated: "#141414",
          hover: "#1a1a1a",
        },
        content: {
          primary: "#e4e4e7",
          secondary: "#c4c4cc",
          muted: "#9a9aa4",
          faint: "#75757f",
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
