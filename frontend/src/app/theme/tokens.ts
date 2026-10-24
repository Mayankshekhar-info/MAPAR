/**
 * MAPAR-v2 Enterprise Design System Tokens
 * Source of truth for color palettes, surfaces, typography, spacing, radius, and elevation.
 */

export const colorTokens = {
  // Brand Primary (Enterprise Sky/Cobalt)
  primary: {
    lighter: "#E0F2FE",
    light: "#38BDF8",
    main: "#0284C7",
    dark: "#0369A1",
    darker: "#0C4A6E",
    contrastText: "#FFFFFF",
  },

  // Secondary Slate
  secondary: {
    lighter: "#F1F5F9",
    light: "#94A3B8",
    main: "#475569",
    dark: "#1E293B",
    darker: "#0F172A",
    contrastText: "#FFFFFF",
  },

  // Dark Navigation Shell (Sidebar & Header highlights)
  nav: {
    background: "#080C14",       // Deepest Slate-Black
    surface: "#0D1322",          // Elevated nav surface
    surfaceHover: "rgba(255, 255, 255, 0.04)",
    surfaceActive: "rgba(2, 132, 199, 0.14)",
    border: "rgba(255, 255, 255, 0.08)",
    borderSubtle: "rgba(255, 255, 255, 0.04)",
    textPrimary: "#FFFFFF",
    textSecondary: "#E2E8F0",
    textMuted: "#94A3B8",
    accent: "#38BDF8",
    accentGlow: "rgba(56, 189, 248, 0.25)",
  },

  // Main Workspace Surfaces
  workspace: {
    background: "#F8FAFC",       // Slate 50 clean background
    surface: "#FFFFFF",          // Card surface
    surfaceElevated: "#FFFFFF",
    border: "#E2E8F0",           // Slate 200
    borderSubtle: "#F1F5F9",     // Slate 100
    divider: "#E2E8F0",
  },

  // Content Text Colors
  text: {
    primary: "#0F172A",          // Slate 900
    secondary: "#475569",        // Slate 600
    muted: "#94A3B8",            // Slate 400
    inverse: "#FFFFFF",
  },

  // Semantic Status Tokens
  status: {
    success: {
      main: "#10B981",
      light: "#ECFDF5",
      border: "#A7F3D0",
      text: "#065F46",
    },
    warning: {
      main: "#F59E0B",
      light: "#FFFBEB",
      border: "#FDE68A",
      text: "#92400E",
    },
    error: {
      main: "#EF4444",
      light: "#FEF2F2",
      border: "#FECACA",
      text: "#991B1B",
    },
    info: {
      main: "#0284C7",
      light: "#F0F9FF",
      border: "#BAE6FD",
      text: "#075985",
    },
    neutral: {
      main: "#64748B",
      light: "#F8FAFC",
      border: "#E2E8F0",
      text: "#334155",
    },
  },
} as const;

export const spacingTokens = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
} as const;

export const radiusTokens = {
  xs: "4px",
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
} as const;

export const shadowTokens = {
  subtle: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
  card: "0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
  cardHover: "0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04)",
  dropdown: "0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.05)",
  modal: "0 20px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1)",
} as const;
