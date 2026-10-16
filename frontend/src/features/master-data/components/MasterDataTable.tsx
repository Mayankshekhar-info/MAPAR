import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

import { MasterDataColumn, MasterDataRecord } from "../types/masterData.types";
import { LoadingState } from "../../../components/LoadingState";
import { EmptyState } from "../../../components/EmptyState";

interface MasterDataTableProps {
  columns: MasterDataColumn[];
  records: MasterDataRecord[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  isLoading: boolean;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  onSearchChange: (val: string) => void;
  onEditRecord: (record: MasterDataRecord) => void;
  canEdit?: boolean;
}

export const MasterDataTable: React.FC<MasterDataTableProps> = ({
  columns,
  records,
  total,
  page,
  pageSize,
  search,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onEditRecord,
  canEdit = true,
}) => {
  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: "12px",
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        backgroundColor: "background.paper",
      }}
    >
      {/* Table Toolbar */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundColor: (theme) => (theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "grey.50"),
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Operational Records
          </Typography>
          <Chip label={`${total} records`} size="small" sx={{ fontWeight: 600, fontSize: "0.75rem" }} />
        </Stack>

        <TextField
          size="small"
          placeholder="Search records in dataset..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{ width: { xs: "100%", sm: 300 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Table Content */}
      {isLoading ? (
        <Box sx={{ p: 6 }}>
          <LoadingState message="Loading Master Data operational records..." />
        </Box>
      ) : records.length === 0 ? (
        <Box sx={{ p: 6 }}>
          <EmptyState
            title="No Master Data Records Found"
            description={
              search
                ? `No records match your search query '${search}'.`
                : "No operational records found for this organizational context. Upload an Excel file to ingest master data."
            }
          />
        </Box>
      ) : (
        <>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small" sx={{ minWidth: 800 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: 70, backgroundColor: "background.paper" }}>
                    Row #
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 100, backgroundColor: "background.paper" }}>
                    Status
                  </TableCell>

                  {/* Dynamic Columns */}
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      sx={{
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        backgroundColor: "background.paper",
                      }}
                    >
                      {col.display_label}
                      {col.is_required && (
                        <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>
                          *
                        </Typography>
                      )}
                    </TableCell>
                  ))}

                  <TableCell sx={{ fontWeight: 700, width: 90, textAlign: "center", backgroundColor: "background.paper" }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((rec) => {
                  return (
                    <TableRow
                      key={rec.id}
                      hover
                      sx={{
                        "&:hover": { backgroundColor: "action.hover" },
                        cursor: "pointer",
                      }}
                      onClick={() => onEditRecord(rec)}
                    >
                      <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>
                        {rec.row_index}
                      </TableCell>

                      <TableCell>
                        {rec.is_valid ? (
                          <Chip
                            icon={<CheckCircleIcon sx={{ fontSize: "14px !important" }} />}
                            label={rec.is_imported ? "Imported" : "Valid"}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ height: 22, fontSize: "0.72rem", fontWeight: 600 }}
                          />
                        ) : (
                          <Tooltip title={rec.validation_errors.join("; ")}>
                            <Chip
                              icon={<ErrorIcon sx={{ fontSize: "14px !important" }} />}
                              label="Error"
                              size="small"
                              color="error"
                              variant="outlined"
                              sx={{ height: 22, fontSize: "0.72rem", fontWeight: 600 }}
                            />
                          </Tooltip>
                        )}
                      </TableCell>

                      {/* Dynamic Cell Values */}
                      {columns.map((col) => {
                        const cellVal = rec.raw_data[col.name] ?? rec.raw_data[col.display_label] ?? "—";
                        return (
                          <TableCell key={col.id} sx={{ whiteSpace: "nowrap" }}>
                            {String(cellVal)}
                          </TableCell>
                        );
                      })}

                      <TableCell
                        sx={{ textAlign: "center" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditRecord(rec);
                        }}
                      >
                        <Tooltip title={canEdit ? "Edit Record" : "View Record"}>
                          <IconButton size="small" color="primary">
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, newPage) => onPageChange(newPage)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
            rowsPerPageOptions={[25, 50, 100, 200]}
            sx={{ borderTop: "1px solid", borderColor: "divider" }}
          />
        </>
      )}
    </Card>
  );
};
