import React from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { colorTokens } from "../../app/theme/tokens";

export interface LoadingStateProps {
  message?: string;
  minHeight?: number | string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading MAPAR enterprise data...",
  minHeight = 240,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight,
        gap: 2,
      }}
    >
      <CircularProgress size={32} thickness={4} sx={{ color: colorTokens.primary.main }} />
      {message && (
        <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontWeight: 500 }}>
          {message}
        </Typography>
      )}
    </Box>
  );
};
