import React from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { colorTokens } from "../../../app/theme/tokens";

interface OrganizationSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const OrganizationSearch: React.FC<OrganizationSearchProps> = ({
  value,
  onChange,
  placeholder = "Search Organization by Name, Code, Circle, Domain...",
}) => {
  return (
    <Box sx={{ width: "100%", maxWidth: 450 }}>
      <TextField
        id="input-organization-search"
        fullWidth
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: colorTokens.text.secondary }} />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => onChange("")}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            borderRadius: "10px",
            bgcolor: colorTokens.workspace.surface,
            "& fieldset": {
              borderColor: colorTokens.workspace.divider,
            },
            "&:hover fieldset": {
              borderColor: colorTokens.primary.main,
            },
          },
        }}
      />
    </Box>
  );
};
