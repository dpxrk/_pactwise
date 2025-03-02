/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        gold: {
          light: "hsl(var(--elegant-gold-light))",
          DEFAULT: "hsl(var(--elegant-gold))",
          dark: "hsl(var(--elegant-gold-dark))",
        },
        navy: {
          light: "#1E3A8A",
          DEFAULT: "#0A192F",
          dark: "#050C17",
        },
        metallic: {
          silver: "#C0C0C0",
          platinum: "#E5E4E2",
          bronze: "#CD7F32",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "luxury-sm":
          "0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(197, 165, 114, 0.15)",
        luxury:
          "0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(197, 165, 114, 0.15)",
        "luxury-lg":
          "0 10px 15px rgba(0, 0, 0, 0.05), 0 4px 6px rgba(197, 165, 114, 0.15)",
        "glass": "0 4px 30px rgba(0, 0, 0, 0.05)",
        "elegant": "0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "fade-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        float: {
          "0%, 100%": {
            transform: "translate(0px, 0px) rotate(0deg) scale(1)",
          },
          "33%": {
            transform: "translate(10px, -10px) rotate(2deg) scale(1.01)",
          },
          "66%": {
            transform: "translate(-5px, 5px) rotate(-1deg) scale(0.99)",
          },
        },
        gradient: {
          "0%, 100%": {
            "background-size": "200% 200%",
            "background-position": "left center",
          },
          "50%": {
            "background-size": "200% 200%",
            "background-position": "right center",
          },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulse: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.5 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        float: "float 20s ease-in-out infinite",
        gradient: "gradient 8s ease infinite",
        shimmer: "shimmer 8s ease-in-out infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      fontFamily: {
        serif: ["Playfair Display", "serif"],
        sans: ["Inter", "sans-serif"],
      },
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        md: "8px",
        lg: "16px",
        xl: "24px",
        "2xl": "40px",
        "3xl": "64px",
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, hsl(var(--gold)) 0%, hsl(var(--gold-dark)) 100%)",
        "gold-shine": "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
        "luxury-gradient": "linear-gradient(to right, hsl(var(--primary)), hsl(var(--gold)), hsl(var(--primary)))",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    function ({ addUtilities }) {
      addUtilities({
        ".animation-delay-2000": {
          "animation-delay": "2s",
        },
        ".animation-delay-4000": {
          "animation-delay": "4s",
        },
        ".text-balance": {
          "text-wrap": "balance",
        },
        ".text-shadow-sm": {
          "text-shadow": "0 1px 2px rgba(0, 0, 0, 0.1)",
        },
        ".text-shadow-md": {
          "text-shadow": "0 2px 4px rgba(0, 0, 0, 0.1)",
        },
        ".backdrop-blur-xs": {
          "backdrop-filter": "blur(2px)",
        },
        ".bg-clip-text": {
          "-webkit-background-clip": "text",
          "background-clip": "text",
        },
        ".subtle-shadow": {
          "box-shadow": "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
        },
      });
    },
  ],
};