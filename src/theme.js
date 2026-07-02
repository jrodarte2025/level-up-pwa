// src/theme.js
// Level Up Cincinnati — MUI theme
// Desktop-first redesign (2026-07): full brand token integration.
// Visual language shared with the mobile app (src/theme/tokens.ts) and the
// admin dashboard (level-up-admin). Brand guide: Roboto body, Poppins display.
import { createTheme } from '@mui/material/styles';
import { brandColors, borderRadius, shadows } from './brandColors';

const navy = brandColors.primary.blue;
const coral = brandColors.primary.coral;
const neutral = brandColors.neutral;

export const getTheme = (mode = 'light') => createTheme({
  palette: {
    mode,
    primary: {
      main: navy,
      light: brandColors.primary.navyLight,
      dark: brandColors.primary.navyDark,
      contrastText: neutral.white,
    },
    secondary: {
      main: coral,
      light: brandColors.primary.coralLight,
      dark: '#DE4948',
      contrastText: neutral.white,
    },
    success: {
      main: brandColors.functional.success,
    },
    warning: {
      main: brandColors.functional.warning,
    },
    error: {
      main: brandColors.functional.error,
    },
    info: {
      main: brandColors.accent.teal,
      contrastText: neutral.white,
    },
    divider: neutral[200],
    ...(mode === 'light'
      ? {
          background: {
            default: neutral[50],
            paper: neutral.white,
          },
          text: {
            primary: neutral[900],
            secondary: neutral[500],
          },
        }
      : {
          background: {
            default: '#121212',
            paper: '#1e1e1e',
          },
          text: {
            primary: '#ffffff',
            secondary: '#bbbbbb',
          },
        }),
  },
  shape: {
    borderRadius: borderRadius.sm,
  },
  typography: {
    // Roboto = primary font (95%+ of UI). Poppins = display/accent only.
    fontFamily: '"Roboto", system-ui, -apple-system, "Segoe UI", "Helvetica", "Arial", sans-serif',
    h1: {
      fontFamily: '"Poppins", "Roboto", sans-serif',
      fontWeight: 700,
      fontSize: '2rem',
      letterSpacing: '-1px',
      lineHeight: 1.15,
    },
    h2: {
      fontFamily: '"Poppins", "Roboto", sans-serif',
      fontWeight: 700,
      fontSize: '1.5rem',
      letterSpacing: '-0.5px',
      lineHeight: 1.2,
    },
    h3: {
      fontFamily: '"Poppins", "Roboto", sans-serif',
      fontWeight: 600,
      fontSize: '1.25rem',
      letterSpacing: '-0.25px',
    },
    h4: {
      fontFamily: '"Poppins", "Roboto", sans-serif',
      fontWeight: 600,
      fontSize: '1.1rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '0.95rem',
    },
    subtitle1: {
      fontWeight: 600,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.55,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
    overline: {
      fontWeight: 600,
      fontSize: '0.6875rem',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
  },
  shadows: [
    'none',
    shadows.sm,
    shadows.sm,
    shadows.md,
    shadows.md,
    shadows.md,
    shadows.lg,
    shadows.lg,
    ...Array(17).fill(shadows.lg),
  ],
  components: {
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: borderRadius.md,
          border: `1px solid ${neutral[200]}`,
          boxShadow: shadows.sm,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: borderRadius.md,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: borderRadius.sm,
          fontWeight: 600,
          paddingLeft: 16,
          paddingRight: 16,
        },
        containedSecondary: {
          '&:hover': {
            backgroundColor: '#DE4948',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: borderRadius.full,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.sm,
          backgroundColor: neutral.white,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: navy,
          fontSize: '0.75rem',
        },
      },
    },
  },
});
