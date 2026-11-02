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
        primary: { main: '#01c38d', contrastText: '#191e29' }, // token-exempt
        secondary: { main: '#0a786a' }, // token-exempt
        background: { paper: '#ffffff', default: '#f5f7fa' }, // token-exempt
        text: { primary: '#191e29', secondary: '#3f4653', disabled: '#5e6573' }, // token-exempt
        success: { main: '#0a786a' }, // token-exempt
        warning: { main: '#8a5a00' }, // token-exempt
        error: { main: '#b3261e' }, // token-exempt
        info: { main: '#2856b8' }, // token-exempt
        divider: 'rgba(25, 30, 41, 0.10)', // token-exempt
        grey: {
          100: '#f5f7fa', 200: '#edf0f4', 300: '#e4e8ee', 400: '#c5cad3', 500: '#8f96a3', 600: '#5e6573', 700: '#3f4653', 800: '#262e3c', 900: '#191e29', // token-exempt
        },
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        primary: { main: '#01c38d', contrastText: '#191e29' }, // token-exempt
        secondary: { main: '#2adba6' }, // token-exempt
        background: { paper: '#1f2634', default: '#191e29' }, // token-exempt
        text: { primary: '#ffffff', secondary: '#b9bfca', disabled: '#8f96a3' }, // token-exempt
        success: { main: '#01c38d' }, // token-exempt
        warning: { main: '#f5b942' }, // token-exempt
        error: { main: '#f5837b' }, // token-exempt
        info: { main: '#5ba7f7' }, // token-exempt
        divider: 'rgba(255, 255, 255, 0.10)', // token-exempt
        grey: {
          100: '#262e3c', 200: '#2c3544', 300: '#35404f', 400: '#46515f', 500: '#696e79', 600: '#8f96a3', 700: '#b9bfca', 800: '#dde1e7', 900: '#ffffff', // token-exempt
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
