/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#0A0E16",
        surface: {
          DEFAULT: "#131A26",
          light: "#1B2333",
        },
        ledger: {
          DEFAULT: "#818CF8",
          dark: "#6366F1",
          light: "#2A2F55",
        },
        stamp: {
          DEFAULT: "#FF6B52",
          dark: "#E5492F",
        },
        ink: "#E7EAF3",
        rule: "#232B3D",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
}
