import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070b14",
        panel: "#0f1726",
        panelSoft: "#162033",
        line: "#29344a",
        signal: "#6ee7b7",
        ember: "#fb923c",
        sky: "#38bdf8",
        violetless: "#b8c4ff"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(7, 11, 20, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
