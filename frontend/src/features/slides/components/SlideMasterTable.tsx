import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import SentimentDissatisfiedOutlinedIcon from "@mui/icons-material/SentimentDissatisfiedOutlined";
import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { SlideMasterRowData, SlideMasterTableResponse } from "../types/slide.types";
import { SlideMasterRow } from "./SlideMasterRow";

interface SlideMasterTableProps {
  tableData?: SlideMasterTableResponse;
  isLoading: boolean;
  onRowClick: (row: SlideMasterRowData) => void;
}

export const SlideMasterTable: React.FC<SlideMasterTableProps> = ({ tableData, isLoading, onRowClick }) => {
  if (isLoading) {
    return (
      <Card
        sx={{
          borderRadius: radiusTokens.lg,
          border: `1px solid ${colorTokens.workspace.border}`,
          boxShadow: shadowTokens.subtle,
          bgcolor: "#FFFFFF",
          p: 3,
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Box key={i} sx={{ display: "flex", gap: 2, mb: 2 }}>
            <Skeleton variant="rectangular" width="20%" height={38} sx={{ borderRadius: radiusTokens.sm }} />
            <Skeleton variant="rectangular" width="15%" height={38} sx={{ borderRadius: radiusTokens.sm }} />
            <Skeleton variant="rectangular" width="25%" height={38} sx={{ borderRadius: radiusTokens.sm }} />
            <Skeleton variant="rectangular" width="10%" height={38} sx={{ borderRadius: radiusTokens.sm }} />
            <Skeleton variant="rectangular" width="10%" height={38} sx={{ borderRadius: radiusTokens.sm }} />
            <Skeleton variant="rectangular" width="10%" height={38} sx={{ borderRadius: radiusTokens.sm }} />
            <Skeleton variant="rectangular" width="10%" height={38} sx={{ borderRadius: radiusTokens.sm }} />
          </Box>
        ))}
      </Card>
    );
  }

  const rows = tableData?.rows || [];
  const grandTotal = tableData?.grand_total;

  if (rows.length === 0) {
    return (
      <Card
        sx={{
          p: 6,
          textAlign: "center",
          borderRadius: radiusTokens.lg,
          border: `1px solid ${colorTokens.workspace.border}`,
          bgcolor: "#FFFFFF",
          boxShadow: shadowTokens.subtle,
        }}
      >
        <Box
          sx={{
            width: 60,
            height: 60,
            borderRadius: radiusTokens.full,
            bgcolor: colorTokens.workspace.background,
            color: colorTokens.text.muted,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2,
          }}
        >
          <SentimentDissatisfiedOutlinedIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1 }}>
          No Operational Records Found
        </Typography>
        <Typography variant="body2" sx={{ color: colorTokens.text.secondary, maxWidth: 450, mx: "auto" }}>
          No records match the current organization filters or search query. Try broadening your Company, Project, Circle, or Status criteria.
        </Typography>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        borderRadius: radiusTokens.lg,
        border: `1px solid ${colorTokens.workspace.border}`,
        boxShadow: shadowTokens.subtle,
        bgcolor: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      <TableContainer sx={{ maxHeight: "calc(100vh - 280px)" }}>
        <Table stickyHeader size="small" aria-label="Slide View Operational Master Matrix">
          <TableHead>
            <TableRow
              sx={{
                "& th": {
                  bgcolor: colorTokens.workspace.background,
                  color: colorTokens.text.secondary,
                  fontWeight: 700,
                  fontSize: "0.74rem",
                  letterSpacing: "0.04em",
                  borderBottom: `2px solid ${colorTokens.workspace.border}`,
                  py: 1.5,
                },
              }}
            >
              <TableCell sx={{ minWidth: 180 }}>ORGANIZATIONAL UNIT</TableCell>
              <TableCell sx={{ minWidth: 150 }}>DOMAIN</TableCell>
              <TableCell sx={{ minWidth: 200 }}>RESOURCE / OPERATION</TableCell>
              <TableCell align="right" sx={{ minWidth: 120 }}>REQUIRED</TableCell>
              <TableCell align="right" sx={{ minWidth: 120 }}>AVAILABLE</TableCell>
              <TableCell align="right" sx={{ minWidth: 100 }}>GAP</TableCell>
              <TableCell align="right" sx={{ minWidth: 120 }}>ACHIEVEMENT</TableCell>
              <TableCell align="center" sx={{ minWidth: 90 }}>STATUS</TableCell>
              <TableCell align="center" sx={{ minWidth: 70 }}>INSPECT</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <SlideMasterRow key={String(row.id)} row={row} onClick={onRowClick} />
            ))}
            {grandTotal && <SlideMasterRow row={grandTotal} onClick={() => {}} />}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
};
