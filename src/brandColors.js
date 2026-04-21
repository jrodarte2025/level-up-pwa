// src/brandColors.js
// Level Up Cincinnati Brand Tokens
//
// COLOR USAGE GUIDELINES (60-30-10 rule):
// - Primary (60%): headlines, primary text, navigation, primary buttons, major sections
// - Secondary (30%): secondary backgrounds, card backgrounds, borders, less prominent UI
// - Accent (10%): visual interest, special highlights — use sparingly
// - Functional: specific states (success, error, warning)
// - Neutrals: foundation for text and backgrounds
//
// TOKEN STRUCTURE:
// brandColors, spacing, borderRadius, shadows — mirrors the mobile app's design tokens
// (see ~/Projects/level-up/level-up-app/src/theme/tokens.ts) so web and mobile share a
// common visual language. Existing keys are preserved; newer scales/variants are additive.

export const brandColors = {
  primary: {
    blue: '#18264E',       // Primary Blue - Trust & professionalism
    coral: '#F15F5E',      // Primary Coral - Energy & warmth

    // Extended scale (mirrors mobile tokens)
    navyLight: '#1E3060',
    navyDark: '#0F1A36',
    coralLight: '#FF7A79',
    coralPale: '#FFF0EE',
  },
  secondary: {
    softBlue: '#6B7BA8',
    lightCoral: '#FFA69E',

    // Extended scale
    bluePale: '#EEF1F7',
  },
  accent: {
    mutedGray: '#d8d9df',
    teal: '#4CAFB6',

    // Extended scale
    tealLight: '#6DD5DB',
    tealPale: '#E8F8F9',
  },
  functional: {
    success: '#10b981',

    // Extended state colors
    successPale: '#ECFDF5',
    warning: '#F59E0B',
    warningPale: '#FFFBEB',
    error: '#EF4444',
    errorPale: '#FEF2F2',
  },
  neutral: {
    // Semantic names (preserved for backwards compatibility)
    deepGray: '#111827',
    mediumGray: '#4b5563',
    lightGray: '#9ca3af',
    offWhite: '#f3f4f6',
    white: '#ffffff',

    // Full grayscale (mirrors mobile tokens)
    50: '#F8F7F4',
    100: '#FBF9F6',
    150: '#F0EEE9',
    200: '#E8E6E1',
    300: '#D1CDC4',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#1A1A2E',
  },
  overlay: {
    light: 'rgba(255, 255, 255, 0.9)',
    dark: 'rgba(15, 26, 54, 0.6)',
    shadow: 'rgba(24, 38, 78, 0.08)',
  },
};

// Spacing scale — 4pt grid, matches mobile tokens
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border radius scale, matches mobile tokens
export const borderRadius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
};

// Shadow scale — CSS box-shadow equivalents of mobile RN shadows
// Colored with navy tint at low opacity for a branded feel
export const shadows = {
  sm: '0 1px 3px rgba(24, 38, 78, 0.06)',
  md: '0 4px 12px rgba(24, 38, 78, 0.08)',
  lg: '0 8px 24px rgba(24, 38, 78, 0.12)',
};

// CSS Variable names for use in styled-components or inline styles
export const brandColorVars = {
  primary: {
    blue: 'var(--brand-primary-blue)',
    coral: 'var(--brand-primary-coral)',
  },
  secondary: {
    softBlue: 'var(--brand-soft-blue)',
    lightCoral: 'var(--brand-light-coral)',
  },
  accent: {
    mutedGray: 'var(--brand-muted-gray)',
    teal: 'var(--brand-accent-teal)',
  },
  functional: {
    success: 'var(--brand-success)',
  },
  neutral: {
    deepGray: 'var(--brand-deep-gray)',
    mediumGray: 'var(--brand-medium-gray)',
    lightGray: 'var(--brand-light-gray)',
    offWhite: 'var(--brand-off-white)',
    white: 'var(--brand-white)',
  },
};

// Helper function to get color with opacity
export const withOpacity = (color, opacity) => {
  // Convert hex to rgba
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export default brandColors;
