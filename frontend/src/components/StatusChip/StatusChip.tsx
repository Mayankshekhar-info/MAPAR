import React from "react";
import Chip, { ChipProps } from "@mui/material/Chip";
import { colorTokens } from "../../app/theme/tokens";

export type SemanticStatus = "success" | "warning" | "error" | "info" | "neutral";

export interface StatusChipProps extends Omit<ChipProps, "color"> {
  status?: SemanticStatus;
  label?: React.ReactNode;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status = "neutral",
  label,
  size = "small",
  sx,
  ...rest
}) => {
  const token = colorTokens.status[status] || colorTokens.status.neutral;

  return (
    <Chip
      size={size}
      label={label}
      sx={{
        fontWeight: 600,
        fontSize: "0.72rem",
        bgcolor: token.light,
        color: token.text,
        border: `1px solid ${token.border}`,
        height: size === "small" ? 22 : 28,
        ...sx,
      }}
      {...rest}
    />
  );
};
