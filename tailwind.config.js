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
        teal: {
          light: "hsl(var(--elegant-gold-light))",
          DEFAULT: "hsl(var(--elegant-gold))",
          dark: "hsl(var(--elegant-gold-dark))",
          primary: "hsl(var(--teal-primary))",
          secondary: "hsl(var(--teal-secondary))",
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
          "0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(13, 38, 38, 0.15)",
        luxury:
          "0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(13, 38, 38, 0.15)",
        "luxury-lg":
          "0 10px 15px rgba(0, 0, 0, 0.05), 0 4px 6px rgba(13, 38, 38, 0.15)",
        "glass": "0 4px 30px rgba(0, 0, 0, 0.05)",
        "elegant": "0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03)",
        "card-hover-teal": "0 12px 28px -8px hsla(var(--elegant-gold), 0.3), 0 4px 10px -5px hsla(var(--elegant-gold), 0.2)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" }, // Ensure 0 is a string if Radix expects it
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }, // Ensure 0 is a string
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "gentle-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.03)", opacity: "0.9" },
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
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        // Modern slide animations
        "slide-in-from-bottom": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-from-top": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-from-left": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-from-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        // Scale animations
        "zoom-in": {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "zoom-out": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(0.8)", opacity: "0" },
        },
        // Rotation animations
        "rotate-in": {
          "0%": { transform: "rotate(-180deg) scale(0.8)", opacity: "0" },
          "100%": { transform: "rotate(0deg) scale(1)", opacity: "1" },
        },
        // Glow effect
        "glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)" },
          "50%": { boxShadow: "0 0 30px rgba(59, 130, 246, 0.6)" },
        },
        // Bounce in
        "bounce-in": {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        // Elastic scale
        "elastic-scale": {
          "0%": { transform: "scale(1)" },
          "30%": { transform: "scale(1.25)" },
          "40%": { transform: "scale(0.75)" },
          "60%": { transform: "scale(1.15)" },
          "80%": { transform: "scale(0.95)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "fade-in-up": "fade-in-up 0.7s ease-out forwards",
        "gentle-pulse": "gentle-pulse 2.5s ease-in-out infinite",
        'delicate-sweep-in': 'delicate-sweep-in 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards',
        'icon-subtle-bob': 'icon-subtle-bob 0.6s ease-in-out',
        float: "float 20s ease-in-out infinite", 
        gradient: "gradient 8s ease infinite",
        shimmer: "shimmer 8s ease-in-out infinite", 
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        // Modern animations
        "slide-in-bottom": "slide-in-from-bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-top": "slide-in-from-top 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-left": "slide-in-from-left 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-right": "slide-in-from-right 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "zoom-in": "zoom-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "zoom-out": "zoom-out 0.2s cubic-bezier(0.4, 0, 1, 1)",
        "rotate-in": "rotate-in 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "glow": "glow 2s ease-in-out infinite",
        "bounce-in": "bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "elastic-scale": "elastic-scale 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "Montserrat", "sans-serif"],
        serif: ["var(--font-montserrat)", "Montserrat", "sans-serif"],
        mono: ["var(--font-montserrat)", "Montserrat", "monospace"],
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
       
        "text-gradient-teal": "linear-gradient(to right, hsl(var(--elegant-gold-light)), hsl(var(--elegant-gold)), hsl(var(--elegant-gold-dark)))",
       
        "teal-gradient": "linear-gradient(135deg, hsl(var(--elegant-gold)) 0%, hsl(var(--elegant-gold-dark)) 100%)",
        "teal-shine": "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
        "luxury-gradient": "linear-gradient(to right, hsl(var(--primary)), hsl(var(--elegant-gold)), hsl(var(--primary)))",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    function ({ addUtilities, theme }) {
      addUtilities({
        ".animation-delay-2000": { "animation-delay": "2s" },
        ".animation-delay-4000": { "animation-delay": "4s" },
        ".text-balance": { "text-wrap": "balance" },
        ".text-shadow-sm": { "text-shadow": "0 1px 2px rgba(0, 0, 0, 0.1)" },
        ".text-shadow-md": { "text-shadow": "0 2px 4px rgba(0, 0, 0, 0.1)" },
        ".backdrop-blur-xs": { "backdrop-filter": "blur(2px)" },
        ".bg-clip-text": {
          "-webkit-background-clip": "text",
          "background-clip": "text",
        },
        ".subtle-shadow": {
          "box-shadow": "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
        },
        ".text-gradient-teal": {
          "background-image": theme('backgroundImage.text-gradient-teal'),
          "-webkit-background-clip": "text",
          "background-clip": "text",
          color: "transparent",
        },
        ".perspective": { "perspective": "1000px" },
      });
    },
  ],
};