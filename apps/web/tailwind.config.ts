import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // CSS Variables for consistent theming
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      // Layout-specific spacing and sizing
      spacing: {
        'sidebar-global': 'var(--global-sidebar-width)',
        'sidebar-app': 'var(--app-sidebar-width)',
        'sidebar-app-mobile': 'var(--app-sidebar-width-mobile)',
        'sidebar-app-icon': 'var(--app-sidebar-width-icon)',
        'header': 'var(--header-height)',
      },
      // Layout utilities for dual sidebar
      gridTemplateColumns: {
        'dual-sidebar-collapsed': 'var(--global-sidebar-width) 0 1fr',
        'dual-sidebar-hidden': 'var(--global-sidebar-width) 1fr',
        'dual-sidebar-icon': 'var(--global-sidebar-width) var(--app-sidebar-width-icon) 1fr',
        'dual-sidebar-expanded': 'var(--global-sidebar-width) var(--app-sidebar-width) 1fr',
      },
      // Animation and transitions
      transitionDuration: {
        'sidebar': '200ms',
      },
      transitionTimingFunction: {
        'sidebar': 'ease-out',
      },
      // Font families
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
        'manrope': ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
  // Ensure proper CSS layer ordering
  corePlugins: {
    preflight: true,
  },
}

export default config