import React, { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

import { ImportValidationError } from "../types/uploads.types";
import { colorTokens } from "../../../app/theme/tokens";

interface ValidationErrorsTableProps {
  errors: ImportValidationError[];
  totalErrors: number;
}

export const ValidationErrorsTable: React.FC<ValidationErrorsTableProps> = ({
  errors,
  totalErrors,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredErrors = errors.filter((err) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      String(err.row_index).includes(term) ||
      err.column_name.toLowerCase().includes(term) ||
      err.error_message.toLowerCase().includes(term) ||
      err.cell_value.toLowerCase().includes(term)
    );
  });

  return (
    <Card
      sx={{
        borderRadius: "14px",
        border: `1px solid ${colorTokens.workspace.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      {/* Header & Filter */}
      <Box
        sx={{
          p: 2.5,
          bgcolor: colorTokens.workspace.surface,
          borderBottom: `1px solid ${colorTokens.workspace.divider}`,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <ErrorOutlineIcon sx={{ color: colorTokens.status.error.main }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
              Validation Failure Diagnostics ({totalErrors})
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
              Specific row and column violations identified by the backend validation engine
            </Typography>
          </Box>
        </Box>

        <TextField
          size="small"
          placeholder="Filter errors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: colorTokens.text.muted }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: { xs: "100%", sm: 220 } }}
        />
      </Box>

      {/* Errors Table */}
      <TableContainer sx={{ maxHeight: 420 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, bgcolor: colorTokens.workspace.background, width: 110 }}>
                Row in File
              </TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: colorTokens.workspace.background, width: 180 }}>
                Column Name
              </TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: colorTokens.workspace.background, width: 180 }}>
                Submitted Value
              </TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: colorTokens.workspace.background }}>
                Validation Error Message
              </TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: colorTokens.workspace.background, width: 110 }} align="center">
                Severity
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredErrors.map((err) => (
              <TableRow key={err.id || `${err.row_index}-${err.column_name}`} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                    Row {err.row_index}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.primary.main }}>
                    {err.column_name}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: "monospace",
                      bgcolor: colorTokens.workspace.background,
                      px: 1,
                      py: 0.25,
                      borderRadius: "4px",
                      display: "inline-block",
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {err.cell_value || "<empty>"}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography variant="body2" sx={{ color: colorTokens.status.error.main, fontWeight: 500 }}>
                    {err.error_message}
                  </Typography>
                </TableCell>

                <TableCell align="center">
                  <Chip
                    label={err.severity}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.68rem",
                      bgcolor:
                        err.severity === "ERROR"
                          ? colorTokens.status.error.light
                          : colorTokens.status.warning.light,
                      color:
                        err.severity === "ERROR"
                          ? colorTokens.status.error.main
                          : colorTokens.status.warning.main,
                      borderRadius: "6px",
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
};
