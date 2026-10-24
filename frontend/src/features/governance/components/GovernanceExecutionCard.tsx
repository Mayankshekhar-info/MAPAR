import React, { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import NotificationImportantOutlinedIcon from "@mui/icons-material/NotificationImportantOutlined";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { TimelinePoint, UrgentRiskItem } from "../types/governance.types";
import { GovernanceTargetTimeline } from "./GovernanceTargetTimeline";
import { GovernanceFollowUpSection } from "./GovernanceFollowUpSection";

interface GovernanceExecutionCardProps {
  timeline?: TimelinePoint[];
  urgentItems?: UrgentRiskItem[];
  isLoading?: boolean;
  onSelectAction: (actionId: number) => void;
  sx?: any;
}

export const GovernanceExecutionCard: React.FC<GovernanceExecutionCardProps> = ({
  timeline = [],
  urgentItems = [],
  isLoading = false,
  onSelectAction,
  sx,
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);

  const totalDeadlines = timeline.reduce((acc, curr) => acc + curr.count, 0);
  const urgentCount = urgentItems.length;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: radiusTokens.lg,
        border: `1px solid ${colorTokens.workspace.border}`,
        backgroundColor: colorTokens.workspace.surface,
        overflow: "hidden",
        ...sx,
      }}
    >
      <Box
        sx={{
          borderBottom: `1px solid ${colorTokens.workspace.border}`,
          px: 2,
          pt: 1,
          backgroundColor: "#F8FAFC",
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          sx={{
            minHeight: 44,
            "& .MuiTab-root": {
              minHeight: 44,
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.82rem",
              color: colorTokens.text.secondary,
              "&.Mui-selected": { color: colorTokens.primary.main },
            },
          }}
        >
          <Tab
            icon={<CalendarTodayOutlinedIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Target Timeline (${totalDeadlines})`}
          />
          <Tab
            icon={
              <NotificationImportantOutlinedIcon
                sx={{ fontSize: 18, color: urgentCount > 0 ? "#DC2626" : "inherit" }}
              />
            }
            iconPosition="start"
            label={`Urgent Follow-Up (${urgentCount})`}
          />
        </Tabs>
      </Box>

      <Box sx={{ p: 2 }}>
        {activeTab === 0 ? (
          <GovernanceTargetTimeline
            timeline={timeline}
            isLoading={isLoading}
            onSelectAction={onSelectAction}
            sx={{ border: "none", p: 0, mb: 0 }}
          />
        ) : (
          <GovernanceFollowUpSection
            urgentItems={urgentItems}
            isLoading={isLoading}
            onSelectAction={onSelectAction}
            sx={{ border: "none", p: 0, mb: 0 }}
          />
        )}
      </Box>
    </Paper>
  );
};
