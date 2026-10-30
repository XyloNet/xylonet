import type { WidgetTheme } from '@lifi/widget'

// The widget is MUI under the hood and needs concrete colours (it derives
// alpha variants from them), so these hex values mirror the tokens in
// src/app/globals.css one for one. Change them together.
// token-exempt: LI.FI widget palette mirrors globals.css tokens

const FONT = 'var(--font-sans-app), ui-sans-serif, system-ui, sans-serif'

export const lifiTheme: WidgetTheme = {
  colorSchemes: {
    light: {
      palette: {
        mode: 'light',
        primary: { main: '#e8461b', contrastText: '#121212' }, // token-exempt
        secondary: { main: '#b9350f' }, // token-exempt
        background: { paper: '#fffdf8', default: '#f4f1ea' }, // token-exempt
        text: { primary: '#121212', secondary: '#4b4740', disabled: '#6b665d' }, // token-exempt
        success: { main: '#b9350f' }, // token-exempt
        warning: { main: '#8a5a00' }, // token-exempt
        error: { main: '#b3261e' }, // token-exempt
        info: { main: '#2856b8' }, // token-exempt
        divider: 'rgba(18, 18, 18, 0.10)', // token-exempt
        grey: {
          100: '#f4f1ea', 200: '#ece7dd', 300: '#e3ddd0', 400: '#c9c2b4', 500: '#8c8477', 600: '#6b665d', 700: '#4b4740', 800: '#2a2622', 900: '#121212', // token-exempt
        },
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        primary: { main: '#e8461b', contrastText: '#121212' }, // token-exempt
        secondary: { main: '#ff6e45' }, // token-exempt
        background: { paper: '#171512', default: '#0f0e0c' }, // token-exempt
        text: { primary: '#f1ece2', secondary: '#b8b0a3', disabled: '#8c8477' }, // token-exempt
        success: { main: '#ff6e45' }, // token-exempt
        warning: { main: '#f0b747' }, // token-exempt
        error: { main: '#f26d65' }, // token-exempt
        info: { main: '#7faef7' }, // token-exempt
        divider: 'rgba(241, 236, 226, 0.10)', // token-exempt
        grey: {
          100: '#221f1b', 200: '#2a2622', 300: '#34302a', 400: '#433e37', 500: '#6e685e', 600: '#8c8477', 700: '#b8b0a3', 800: '#d9d2c5', 900: '#f1ece2', // token-exempt
        },
      },
    },
  },
  shape: {
    borderRadius: 14,
    borderRadiusSecondary: 10,
    borderRadiusTertiary: 6,
  },
  typography: {
    fontFamily: FONT,
    fontWeightMedium: 500,
    fontWeightBold: 600,
  },
  container: {
    borderRadius: '14px',
    border: 'none',
    boxShadow: 'none',
    maxWidth: '100%',
  },
  routesContainer: {
    borderRadius: '14px',
    border: 'none',
    boxShadow: 'none',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: 'none' },
      },
    },
  },
}
