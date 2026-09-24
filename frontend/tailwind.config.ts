/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surface colors (dark theme defaults)
        bg: 'var(--bg)',
        'bg-el': 'var(--bg-el)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        
        // Text colors
        label: 'var(--label)',
        'label-2': 'var(--label-2)',
        'label-3': 'var(--label-3)',
        'label-4': 'var(--label-4)',
        
        // System colors
        sep: 'var(--sep)',
        'sep-op': 'var(--sep-op)',
        
        // Accent colors
        acc: 'var(--acc)',
        'acc-2': 'var(--acc-2)',
        'on-acc': 'var(--on-acc)',
        'acc-soft': 'var(--acc-soft)',
        'acc-line': 'var(--acc-line)',
        
        // System palette (iOS colors)
        apple: {
          blue: 'var(--blue)',
          green: 'var(--green)',
          red: 'var(--red)',
          orange: 'var(--orange)',
          yellow: 'var(--yellow)',
          teal: 'var(--teal)',
          indigo: 'var(--indigo)',
          pink: 'var(--pink)',
          purple: 'var(--purple)',
          mint: 'var(--mint)',
          brown: 'var(--brown)',
          grey: 'var(--grey)',
        }
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        DEFAULT: 'var(--r)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        card: 'var(--r-card)',
      },
      spacing: {
        pad: 'var(--pad)',
        hair: 'var(--hair)',
        'sab': 'var(--sab)',
        'sat': 'var(--sat)',
        // Add fractional and custom spacing
        '0.25': '1px',
        '0.75': '3px',
        '1.25': '5px',
        '1.75': '7px',
        '2.5': '10px',
        '2.75': '11px',
        '3.5': '14px',
        '4.5': '18px',
        '5.5': '22px',
        '7.25': '29px',
        '9': '36px',
        '11.5': '46px',
        '12.5': '50px',
      },
      transitionDuration: {
        fast: 'var(--fast)',
        med: 'var(--med)',
      },
      transitionTimingFunction: {
        ease: 'var(--ease)',
      },
      fontSize: {
        // Type scale
        'large': ['34px', { lineHeight: '1.06', fontWeight: '700', letterSpacing: '-0.028em' }],
        'title': ['28px', { lineHeight: '1.12', fontWeight: '700', letterSpacing: '-0.024em' }],
        'title2': ['22px', { lineHeight: '1.18', fontWeight: '700', letterSpacing: '-0.021em' }],
        'head': ['17px', { lineHeight: '1.29', fontWeight: '600', letterSpacing: '-0.012em' }],
        'body': ['17px', { lineHeight: '1.29', fontWeight: '400', letterSpacing: '-0.012em' }],
        'callout': ['16px', { lineHeight: '1.31', fontWeight: '400', letterSpacing: '-0.009em' }],
        'sub': ['15px', { lineHeight: '1.33', fontWeight: '400', letterSpacing: '-0.006em' }],
        'foot': ['13px', { lineHeight: '1.38', fontWeight: '400', letterSpacing: '-0.001em' }],
        'cap': ['12px', { lineHeight: '1.33', fontWeight: '400', letterSpacing: '0' }],
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Segoe UI"',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
      },
      strokeWidth: {
        icon: 'var(--icon-stroke)',
      },
      scale: {
        '91': '0.91',
        '92': '0.92',
        '95': '0.95',
        '97': '0.97',
        '97.5': '0.975',
        '140': '1.4',
      },
      width: {
        '1em': '1em',
      },
      height: {
        '1em': '1em',
      },
      animation: {
        viewfade: 'viewfade var(--med) var(--ease)',
      },
      keyframes: {
        viewfade: {
          'from': { 'opacity': '0', 'transform': 'translateY(4px)' },
          'to': { 'opacity': '1', 'transform': 'none' },
        },
      },
    },
  },
  corePlugins: {
    // Disable Tailwind's default reset since we have our own
    preflight: false,
  },
  important: false,
}

