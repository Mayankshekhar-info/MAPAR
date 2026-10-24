import React from "react";
import { Grid, Box, Typography } from "@mui/material";
import { KPIDashboardCard as CardData } from "../types/kpi";
import { KPIDashboardCard } from "./KPIDashboardCard";
import { EmptyState } from "../../../components/EmptyState/EmptyState";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";

interface KPICardGridProps {
  cards: CardData[];
  onInspect: (card: CardData) => void;
  onRecalculate?: (card: CardData) => void;
  isCalculating?: boolean;
}

export const KPICardGrid: React.FC<KPICardGridProps> = ({
  cards,
  onInspect,
  onRecalculate,
  isCalculating,
}) => {
  if (!cards || cards.length === 0) {
    return (
      <EmptyState
        title="No KPI Cards Available"
        description="No calculated KPI metrics found for the selected reporting period and hierarchy scope. Try running an upload batch or triggering recalculation."
        icon={<AssessmentOutlinedIcon sx={{ fontSize: 48, color: "text.disabled" }} />}
      />
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={2.5}>
        {cards.map((card) => (
          <Grid key={`${card.kpi_id}-${card.hierarchy_id}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <KPIDashboardCard
              data={card}
              onInspect={onInspect}
              onRecalculate={onRecalculate}
              isCalculating={isCalculating}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
