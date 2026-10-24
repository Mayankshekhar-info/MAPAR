import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import PreviewIcon from "@mui/icons-material/Preview";

import { UploadTemplateColumn } from "../types/uploads.types";
import { colorTokens } from "../../../app/theme/tokens";

interface TemplatePreviewTableProps {
  columns: UploadTemplateColumn[];
}

export const TemplatePreviewTable: React.FC<TemplatePreviewTableProps> = ({ columns }) => {
  return (
    <Card
      sx={{
        borderRadius: "14px",
        border: `1px solid ${colorTokens.workspace.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          p: 2,
          bgcolor: colorTokens.workspace.surface,
          borderBottom: `1px solid ${colorTokens.workspace.divider}`,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <PreviewIcon fontSize="small" sx={{ color: colorTokens.primary.main }} />
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
            Live Excel Template Preview
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
            Exact column order, headers, and validation formats as they will be generated in .xlsx
          </Typography>
        </Box>
      </Box>

      <TableContainer sx={{ maxHeight: 320 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  bgcolor: colorTokens.secondary.dark,
                  color: "#FFFFFF",
                  fontWeight: 700,
                  width: 50,
                  textAlign: "center",
                  borderRight: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                #
              </TableCell>
              {columns.map((col, idx) => (
                <TableCell
                  key={col.name || idx}
                  sx={{
                    bgcolor: col.is_required ? "#0369A1" : "#0284C7",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    borderRight: "1px solid rgba(255,255,255,0.15)",
                    textAlign:
                      col.data_type === "INTEGER" ||
                      col.data_type === "DECIMAL" ||
                      col.data_type === "PERCENTAGE"
                        ? "right"
                        : "left",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent={
                      col.data_type === "INTEGER" ||
                      col.data_type === "DECIMAL" ||
                      col.data_type === "PERCENTAGE"
                        ? "flex-end"
                        : "flex-start"
                    }
                  >
                    <span>{col.display_label || `Column ${idx + 1}`}</span>
                    {col.is_required && (
                      <Typography component="span" sx={{ color: "#FDE047", fontWeight: 900 }}>
                        *
                      </Typography>
                    )}
                    <Chip
                      label={col.data_type}
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: "0.62rem",
                        bgcolor: "rgba(255,255,255,0.2)",
                        color: "#FFFFFF",
                        fontWeight: 600,
                      }}
                    />
                  </Stack>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {[1, 2, 3].map((sampleRowIdx) => (
              <TableRow key={sampleRowIdx} hover>
                <TableCell
                  sx={{
                    textAlign: "center",
                    fontWeight: 600,
                    color: colorTokens.text.muted,
                    bgcolor: colorTokens.workspace.background,
                    borderRight: `1px solid ${colorTokens.workspace.borderSubtle}`,
                  }}
                >
                  {sampleRowIdx + 1}
                </TableCell>
                {columns.map((col, idx) => (
                  <TableCell
                    key={col.name || idx}
                    sx={{
                      color: colorTokens.text.muted,
                      fontStyle: "italic",
                      fontSize: "0.8rem",
                      borderRight: `1px solid ${colorTokens.workspace.borderSubtle}`,
                      textAlign:
                        col.data_type === "INTEGER" ||
                        col.data_type === "DECIMAL" ||
                        col.data_type === "PERCENTAGE"
                          ? "right"
                          : "left",
                    }}
                  >
                    {col.data_type === "INTEGER"
                      ? "100"
                      : col.data_type === "DECIMAL"
                      ? "98.50"
                      : col.data_type === "PERCENTAGE"
                      ? "85%"
                      : col.data_type === "DATE"
                      ? "2026-09-01"
                      : col.data_type === "REFERENCE"
                      ? "CIRC_NORTH"
                      : `[${col.display_label} value]`}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
};
