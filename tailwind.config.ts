import type { Config } from "tailwindcss";
const { fontFamily } = require("tailwindcss/defaultTheme")

// Define the color palette to be safelisted
const padColors = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  'bg-rose-500',
  'bg-red-600', 'bg-orange-600', 'bg-blue-600', 'bg-green-600', 'bg-purple-600',
];


export default {
    darkMode: ["class"],
    content: [
      "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    // Safelist the dynamically used pad colors
    safelist: [
      ...padColors,
      // Include hover/focus states if necessary, e.g., 'hover:bg-red-500'
    ],
    theme: {
      container: { // Add container settings
          center: true,
          padding: "2rem",
          screens: {
              "2xl": "1400px",
          },
      },
      extend: {
        fontFamily: { // Add font family
          sans: ["var(--font-geist-sans)", ...fontFamily.sans],
          mono: ["var(--font-geist-mono)", ...fontFamily.mono],
        },
        colors: {
          background: 'hsl(var(--background))',
          foreground: 'hsl(var(--foreground))',
          card: {
            DEFAULT: 'hsl(var(--card))',
            foreground: 'hsl(var(--card-foreground))'
          },
          popover: {
            DEFAULT: 'hsl(var(--popover))',
            foreground: 'hsl(var(--popover-foreground))'
          },
          primary: {
            DEFAULT: 'hsl(var(--primary))',
            foreground: 'hsl(var(--primary-foreground))'
          },
          secondary: {
            DEFAULT: 'hsl(var(--secondary))',
            foreground: 'hsl(var(--secondary-foreground))'
          },
          muted: {
            DEFAULT: 'hsl(var(--muted))',
            foreground: 'hsl(var(--muted-foreground))'
          },
          accent: {
            DEFAULT: 'hsl(var(--accent))',
            foreground: 'hsl(var(--accent-foreground))'
          },
          destructive: {
            DEFAULT: 'hsl(var(--destructive))',
            foreground: 'hsl(var(--destructive-foreground))'
          },
          border: 'hsl(var(--border))',
          input: 'hsl(var(--input))',
          ring: 'hsl(var(--ring))',
          chart: {
            '1': 'hsl(var(--chart-1))',
            '2': 'hsl(var(--chart-2))',
            '3': 'hsl(var(--chart-3))',
            '4': 'hsl(var(--chart-4))',
            '5': 'hsl(var(--chart-5))'
          },
          sidebar: {
            DEFAULT: 'hsl(var(--sidebar-background))',
            foreground: 'hsl(var(--sidebar-foreground))',
            primary: 'hsl(var(--sidebar-primary))',
            'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
            accent: 'hsl(var(--sidebar-accent))',
            'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
            border: 'hsl(var(--sidebar-border))',
            ring: 'hsl(var(--sidebar-ring))'
          }
        },
        borderRadius: {
          lg: 'var(--radius)',
          md: 'calc(var(--radius) - 2px)',
          sm: 'calc(var(--radius) - 4px)'
        },
        keyframes: {
          'accordion-down': {
            from: {
              height: '0'
            },
            to: {
              height: 'var(--radix-accordion-content-height)'
            }
          },
          'accordion-up': {
            from: {
              height: 'var(--radix-accordion-content-height)'
            },
            to: {
              height: '0'
            }
          },
           // Add fade-in and zoom-in keyframes for subtle animations
           "fade-in": {
              "0%": { opacity: "0" },
              "100%": { opacity: "1" },
            },
            "zoom-in-95": {
              "0%": { opacity: "0", transform: "scale(.95)" },
              "100%": { opacity: "1", transform: "scale(1)" },
            },
            // Keyframes for animated gradient background
            "gradient-xy": {
              '0%, 100%': {
                'background-size': '400% 400%',
                'background-position': 'left center'
              },
              '50%': {
                'background-size': '200% 200%',
                'background-position': 'right center'
              }
            },
            // Keyframes for toast countdown
            "toast-countdown": {
              "0%": { transform: "scaleX(1)" },
              "100%": { transform: "scaleX(0)" },
            },
             // Keyframes for grid square wave/fall animation
            "wave-fall": {
              "0%": { opacity: "0", transform: "translateY(-60%)" }, // Start further up
              "100%": { opacity: "1", transform: "translateY(0%)" },
            },
        },
        animation: {
          'accordion-down': 'accordion-down 0.2s ease-out',
          'accordion-up': 'accordion-up 0.2s ease-out',
           // Use the new keyframes in animation utilities
           "fade-in": "fade-in 0.3s ease-out",
           "zoom-in-95": "zoom-in-95 0.3s ease-out",
           // Animation utility for gradient
           "gradient-xy": 'gradient-xy 15s ease infinite',
           "gradient-xy-slow": 'gradient-xy 25s ease infinite', // Slower version
           // Animation for toast countdown (4 seconds duration)
           "toast-countdown": 'toast-countdown 4s linear forwards',
           // Animation for grid square wave/fall
           "wave-fall": "wave-fall 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards", // Added bounce easing
        }
      }
    },
    plugins: [require("tailwindcss-animate")],
} satisfies Config;
