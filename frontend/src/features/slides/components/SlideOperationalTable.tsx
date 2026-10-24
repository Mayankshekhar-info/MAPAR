import React, { useState } from "react";
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
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";

import { SlideOperationalRecord, SlideUploadedBatch } from "../types/slide.types";
import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { StatusChip } from "../../../components/StatusChip/StatusChip";
import { EmptyState } from "../../../components/EmptyState";

interface SlideOperationalTableProps {
  records: SlideOperationalRecord[];
  uploadedBatches: SlideUploadedBatch[];
  onRecordClick: (recordId: number) => void;
}

export const SlideOperationalTable: React.FC<SlideOperationalTableProps> = ({
  records,
  uploadedBatches,
  onRecordClick,
}) => {
  const [activeTab, setActiveTab] = useState<"kpis" | "uploads">("kpis");

  const formatNumber = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return "—";
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(val);
  };

  const renderTrendIcon = (trend?: string) => {
    if (trend === "UP") return <TrendingUpIcon sx={{ color: colorTokens.status.success.main, fontSize: 16 }} />;
    if (trend === "DOWN") return <TrendingDownIcon sx={{ color: colorTokens.status.error.main, fontSize: 16 }} />;
    return <TrendingFlatIcon sx={{ color: colorTokens.text.muted, fontSize: 16 }} />;
  };

  return (
    <Card
      sx={{
        bgcolor: "#FFFFFF",
        borderRadius: radiusTokens.lg,
        border: `1px solid ${colorTokens.workspace.border}`,
        boxShadow: shadowTokens.subtle,
        overflow: "hidden",
        mt: 3.5,
      }}
    >
      {/* Tabs Header */}
      <Box sx={{ borderBottom: `1px solid ${colorTokens.workspace.border}`, px: 2.5, pt: 1 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          sx={{
            minHeight: 44,
            "& .MuiTab-root": {
              minHeight: 44,
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.85rem",
              color: colorTokens.text.secondary,
              "&.Mui-selected": {
                color: colorTokens.primary.main,
              },
            },
          }}
        >
          <Tab
            value="kpis"
            icon={<TableChartOutlinedIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Operational Metrics (${records.length})`}
          />
          <Tab
            value="uploads"
            icon={<CloudDoneOutlinedIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Uploaded Batches (${uploadedBatches.length})`}
          />
        </Tabs>
      </Box>

      {/* Tab 1: Operational Records (KPIs) */}
      {activeTab === "kpis" && (
        <Box>
          {records.length === 0 ? (
            <Box sx={{ py: 4 }}>
              <EmptyState
                title="No Operational Metrics for this Scope"
                description="There are no KPI records reported under this organization branch for the selected period."
              />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: colorTokens.workspace.background }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      METRIC / KPI
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      CIRCLE / DOMAIN
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      ACTUAL
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      TARGET
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      VARIANCE
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      STATUS
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      TREND
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      SOURCE / USER
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.map((rec) => (
                    <TableRow
                      key={rec.id}
                      hover
                      onClick={() => onRecordClick(rec.id)}
                      sx={{
                        cursor: "pointer",
                        "&:last-child td": { borderBottom: "none" },
                        "&:hover": { bgcolor: colorTokens.workspace.borderSubtle },
                      }}
                    >
                      <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.84rem", color: colorTokens.text.primary }}>
                          {rec.kpi_name}
                        </Typography>
                        <Chip
                          label={rec.kpi_code}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            bgcolor: colorTokens.workspace.borderSubtle,
                            color: colorTokens.text.secondary,
                            borderRadius: radiusTokens.xs,
                          }}
                        />
                      </TableCell>

                      <TableCell>
                        <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: colorTokens.text.primary }}>
                          {rec.circle_name}
                        </Typography>
                        <Typography sx={{ fontSize: "0.72rem", color: colorTokens.text.secondary }}>
                          {rec.domain_name}
                        </Typography>
                      </TableCell>

                      <TableCell align="right">
                        <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", color: colorTokens.text.primary }}>
                          {formatNumber(rec.actual_value)}
                        </Typography>
                        {rec.unit && (
                          <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                            {rec.unit}
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell align="right">
                        <Typography sx={{ fontSize: "0.84rem", color: colorTokens.text.secondary }}>
                          {formatNumber(rec.target_value)}
                        </Typography>
                      </TableCell>

                      <TableCell align="right">
                        <Typography
                          sx={{
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            color: (rec.variance ?? 0) >= 0 ? colorTokens.status.success.text : colorTokens.status.error.text,
                          }}
                        >
                          {(rec.variance ?? 0) >= 0 ? `+${formatNumber(rec.variance)}` : formatNumber(rec.variance)}
                        </Typography>
                        {rec.variance_percentage !== null && (
                          <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                            {rec.variance_percentage > 0 ? `+${rec.variance_percentage}%` : `${rec.variance_percentage}%`}
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell align="center">
                        <StatusChip
                          status={rec.rag_status === "GREEN" ? "success" : rec.rag_status === "AMBER" ? "warning" : "error"}
                          label={rec.rag_status === "GREEN" ? "Optimal" : rec.rag_status === "AMBER" ? "Warning" : "Critical"}
                        />
                      </TableCell>

                      <TableCell align="center">
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {renderTrendIcon(rec.trend)}
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Typography sx={{ fontSize: "0.78rem", color: colorTokens.text.secondary }}>
                          {rec.entered_by}
                        </Typography>
                        {rec.notes && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: colorTokens.text.muted,
                              display: "-webkit-box",
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              maxWidth: 180,
                            }}
                          >
                            {rec.notes}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Tab 2: Uploaded Batches */}
      {activeTab === "uploads" && (
        <Box>
          {uploadedBatches.length === 0 ? (
            <Box sx={{ py: 4 }}>
              <EmptyState
                title="No Upload Batches"
                description="No Excel spreadsheets have been uploaded for this period."
              />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: colorTokens.workspace.background }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      BATCH ID
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      TEMPLATE / FILE
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      STATUS
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      TOTAL ROWS
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      VALID ROWS
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      UPLOADED BY
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                      TIMESTAMP
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {uploadedBatches.map((b) => (
                    <TableRow key={b.id} hover sx={{ "&:last-child td": { borderBottom: "none" } }}>
                      <TableCell>
                        <Chip
                          label={b.batch_id}
                          size="small"
                          sx={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: "0.72rem",
                            borderRadius: radiusTokens.xs,
                          }}
                        />
                      </TableCell>

                      <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color: colorTokens.text.primary }}>
                          {b.template_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                          {b.original_filename}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={b.status}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            fontSize: "0.7rem",
                            bgcolor:
                              b.status === "COMPLETED"
                                ? colorTokens.status.success.light
                                : b.status === "FAILED"
                                ? colorTokens.status.error.light
                                : colorTokens.workspace.borderSubtle,
                            color:
                              b.status === "COMPLETED"
                                ? colorTokens.status.success.text
                                : b.status === "FAILED"
                                ? colorTokens.status.error.text
                                : colorTokens.text.primary,
                          }}
                        />
                      </TableCell>

                      <TableCell align="right">
                        <Typography sx={{ fontWeight: 600, fontSize: "0.82rem" }}>{b.total_rows}</Typography>
                      </TableCell>

                      <TableCell align="right">
                        <Typography sx={{ fontWeight: 600, fontSize: "0.82rem", color: colorTokens.status.success.text }}>
                          {b.valid_rows}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography sx={{ fontSize: "0.8rem", color: colorTokens.text.secondary }}>
                          {b.uploaded_by}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography sx={{ fontSize: "0.76rem", color: colorTokens.text.muted }}>
                          {new Date(b.created_at).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}
    </Card>
  );
};
