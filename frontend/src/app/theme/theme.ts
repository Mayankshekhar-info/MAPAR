import { createTheme } from "@mui/material/styles";
import { colorTokens, radiusTokens, shadowTokens } from "./tokens";

export const theme = createTheme({
  palette: {
    primary: {
      light: colorTokens.primary.light,
      main: colorTokens.primary.main,
      dark: colorTokens.primary.dark,
      contrastText: colorTokens.primary.contrastText,
    },
    secondary: {
      light: colorTokens.secondary.light,
      main: colorTokens.secondary.main,
      dark: colorTokens.secondary.dark,
      contrastText: colorTokens.secondary.contrastText,
    },
    background: {
      default: colorTokens.workspace.background,
      paper: colorTokens.workspace.surface,
    },
    text: {
      primary: colorTokens.text.primary,
      secondary: colorTokens.text.secondary,
    },
    divider: colorTokens.workspace.divider,
    success: {
      main: colorTokens.status.success.main,
      light: colorTokens.status.success.light,
    },
    warning: {
      main: colorTokens.status.warning.main,
      light: colorTokens.status.warning.light,
    },
    error: {
      main: colorTokens.status.error.main,
      light: colorTokens.status.error.light,
    },
    info: {
      main: colorTokens.status.info.main,
      light: colorTokens.status.info.light,
    },
  },

  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    h1: {
      fontSize: "2rem",
      fontWeight: 700,
      lineHeight: 1.25,
      color: colorTokens.text.primary,
    },
    h2: {
      fontSize: "1.5rem",
      fontWeight: 600,
      lineHeight: 1.3,
      color: colorTokens.text.primary,
    },
    h3: {
      fontSize: "1.25rem",
      fontWeight: 600,
      lineHeight: 1.35,
      color: colorTokens.text.primary,
    },
    h4: {
      fontSize: "1.125rem",
      fontWeight: 600,
      lineHeight: 1.4,
      color: colorTokens.text.primary,
    },
    h5: {
      fontSize: "1rem",
      fontWeight: 600,
      lineHeight: 1.4,
      color: colorTokens.text.primary,
    },
    h6: {
      fontSize: "0.875rem",
      fontWeight: 600,
      lineHeight: 1.4,
      color: colorTokens.text.primary,
    },
    body1: {
      fontSize: "0.875rem",
      lineHeight: 1.5,
      color: colorTokens.text.primary,
    },
    body2: {
      fontSize: "0.8125rem",
      lineHeight: 1.5,
      color: colorTokens.text.secondary,
    },
    caption: {
      fontSize: "0.75rem",
      lineHeight: 1.4,
      color: colorTokens.text.muted,
    },
    button: {
      textTransform: "none",
      fontWeight: 500,
      fontSize: "0.875rem",
    },
  },

  shape: {
    borderRadius: 8,
  },

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: radiusTokens.md,
          boxShadow: "none",
          fontWeight: 600,
          "&:hover": {
            boxShadow: shadowTokens.subtle,
          },
        },
        containedPrimary: {
          background: colorTokens.primary.main,
          "&:hover": {
            background: colorTokens.primary.dark,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: radiusTokens.lg,
          border: `1px solid ${colorTokens.workspace.border}`,
          boxShadow: shadowTokens.card,
          transition: "box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out",
          "&:hover": {
            boxShadow: shadowTokens.cardHover,
            borderColor: "#CBD5E1",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: radiusTokens.lg,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${colorTokens.workspace.borderSubtle}`,
          padding: "12px 16px",
          fontSize: "0.84375rem",
        },
        head: {
          backgroundColor: colorTokens.workspace.background,
          color: colorTokens.text.secondary,
          fontWeight: 600,
          textTransform: "uppercase",
          fontSize: "0.75rem",
          letterSpacing: "0.05em",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": {
            backgroundColor: "#F8FAFC",
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colorTokens.secondary.darker,
          fontSize: "0.75rem",
          borderRadius: radiusTokens.sm,
          padding: "6px 10px",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          "&.MuiInputLabel-shrink": {
            backgroundColor: colorTokens.workspace.surface,
            paddingLeft: "4px",
            paddingRight: "4px",
            marginLeft: "-2px",
            borderRadius: "2px",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radiusTokens.md,
        },
      },
    },
  },
});
