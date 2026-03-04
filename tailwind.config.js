/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#1A3A5C",
          blue: "#2B6CB0",
        },
        glass: {
          light: "rgba(255,255,255,0.65)",
          medium: "rgba(255,255,255,0.45)",
          dark: "rgba(255,255,255,0.25)",
          border: "rgba(255,255,255,0.35)",
        },
      },
    },
  },
  plugins: [],
};
