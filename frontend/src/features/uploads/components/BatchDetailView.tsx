import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import dayjs from "dayjs";

import { ValidationSummaryCard } from "./ValidationSummaryCard";
import { ValidationErrorsTable } from "./ValidationErrorsTable";
import { ImportBatch, ImportValidationError } from "../types/uploads.types";
import { colorTokens } from "../../../app/theme/tokens";

interface BatchDetailViewProps {
  batch: ImportBatch;
  errors: ImportValidationError[];
  totalErrors: number;
  isCommitting: boolean;
  canManage?: boolean;
  onCommit: () => void;
  onDownloadErrorReport: () => void;
  onBack: () => void;
}

export const BatchDetailView: React.FC<BatchDetailViewProps> = ({
  batch,
  errors,
  totalErrors,
  isCommitting,
  canManage = true,
  onCommit,
  onDownloadErrorReport,
  onBack,
}) => {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
      {/* Top Header */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            sx={{ color: colorTokens.text.secondary }}
          >
            Back to Uploads
          </Button>
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
              Import Batch Detail: {batch.batch_id}
            </Typography>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
              Original File: <strong>{batch.original_filename}</strong> &bull; Uploaded on{" "}
              {dayjs(batch.created_at).format("MMMM D, YYYY [at] HH:mm")}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Validation Summary Card */}
      <ValidationSummaryCard
        batch={batch}
        isCommitting={isCommitting}
        canManage={canManage}
        onCommit={onCommit}
        onDownloadErrorReport={onDownloadErrorReport}
      />

      {/* Validation Errors Diagnostics Table (if errors exist) */}
      {batch.error_rows > 0 && (
        <ValidationErrorsTable errors={errors} totalErrors={totalErrors} />
      )}

      {/* Data Lineage & Audit Trail */}
      <Card
        sx={{
          borderRadius: "14px",
          border: `1px solid ${colorTokens.workspace.border}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            p: 2.5,
            bgcolor: colorTokens.workspace.surface,
            borderBottom: `1px solid ${colorTokens.workspace.divider}`,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <AccountTreeIcon sx={{ color: colorTokens.primary.main }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
              Data Lineage &amp; Audit Traceability
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
              Complete chronological audit trail from source upload to database commit
            </Typography>
          </Box>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: colorTokens.workspace.background }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Action Performed</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Performed By</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }} align="center">
                  Records Affected
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Event Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {batch.lineage_events && batch.lineage_events.length > 0 ? (
                batch.lineage_events.map((evt) => (
                  <TableRow key={evt.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
                        {dayjs(evt.created_at).format("YYYY-MM-DD HH:mm:ss")}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.primary.main }}>
                        {evt.action}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: colorTokens.text.primary }}>
                        {evt.performed_by_name}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                        {evt.records_affected}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontFamily: "monospace" }}>
                        {JSON.stringify(evt.details)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: "center", py: 3, color: colorTokens.text.muted }}>
                    Initial file ingested and validated. Pending user commit.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
};
