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
        // ... (other colors remain the same)
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
        "card-hover-gold": "0 12px 28px -8px hsla(var(--elegant-gold), 0.3), 0 4px 10px -5px hsla(var(--elegant-gold), 0.2)",
      },
      keyframes: {
        // ... (accordion, fade-in, float, gradient, shimmer, pulse keyframes remain the same)
        "fade-in-up": { // Keeping this as a fallback or for other uses
          from: { opacity: 0, transform: "translateY(20px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "gentle-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: 1 },
          "50%": { transform: "scale(1.03)", opacity: 0.9 },
        },
        'delicate-sweep-in': {
          '0%': {
            opacity: '0',
            transform: 'translateY(35px) rotateX(-15deg) scale(0.97)',
            filter: 'blur(2px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) rotateX(0deg) scale(1)',
            filter: 'blur(0px)',
          },
        },
        'icon-subtle-bob': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-3px) scale(1.05)' },
        }
      },
      animation: {
        // ... (accordion, fade-in, float, gradient, shimmer, pulse animations remain the same)
        "fade-in-up": "fade-in-up 0.7s ease-out forwards",
        "gentle-pulse": "gentle-pulse 2.5s ease-in-out infinite",
        'delicate-sweep-in': 'delicate-sweep-in 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards', // Smoother easing
        'icon-subtle-bob': 'icon-subtle-bob 0.6s ease-in-out', // For icon hover
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
        "text-gradient-gold": "linear-gradient(to right, hsl(var(--elegant-gold-light)), hsl(var(--elegant-gold)), hsl(var(--elegant-gold-dark)))",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    function ({ addUtilities }) {
      addUtilities({
        ".animation-delay-2000": { "animation-delay": "2s" },
        ".animation-delay-4000": { "animation-delay": "4s" },
        ".text-balance": { "text-wrap": "balance" },
        ".text-shadow-sm": { "text-shadow": "0 1px 2px rgba(0, 0, 0, 0.1)" },
        ".text-shadow-md": { "text-shadow": "0 2px 4px rgba(0, 0, 0, 0.1)" },
        ".backdrop-blur-xs": { "backdrop-filter": "blur(2px)" },
        ".bg-clip-text": { "-webkit-background-clip": "text", "background-clip": "text" },
        ".subtle-shadow": { "box-shadow": "0 4px 20px -2px rgba(0, 0, 0, 0.05)" },
        ".text-gradient-gold": { "@apply bg-text-gradient-gold bg-clip-text text-transparent": {} },
        // Added utility for perspective for 3D-ish transforms
        ".perspective": { "perspective": "1000px" },
      });
    },
  ],
};