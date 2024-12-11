import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    fontFamily: {
      // sans: ["Optima", "Candara", "Noto Sans", "source-sans-pro", "sans-serif"],
      sans: ["Avenir", "Montserrat", "Corbel", "URW Gothic", "source-sans-pro", "sans-serif"],
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
} satisfies Config;
