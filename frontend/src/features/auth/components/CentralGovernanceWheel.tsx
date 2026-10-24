import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";

interface GovernanceSegment {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  angle: number; // in degrees
  iconPath: string;
}

const SEGMENTS: GovernanceSegment[] = [
  {
    id: "target_setting",
    title: "Target Setting",
    subtitle: "Deliverables & Timelines",
    color: "#38BDF8", // Cyan / Sky Blue
    angle: 300,
    iconPath: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5z",
  },
  {
    id: "action_tracking",
    title: "Action Tracking",
    subtitle: "Closed-Loop Execution",
    color: "#06B6D4", // Teal
    angle: 0,
    iconPath: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  },
  {
    id: "weekly_reporting",
    title: "Weekly Updates",
    subtitle: "% Velocity & Milestones",
    color: "#10B981", // Emerald
    angle: 60,
    iconPath: "M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z",
  },
  {
    id: "evidence_audit",
    title: "Evidence Audit",
    subtitle: "Verifiable Documents",
    color: "#F59E0B", // Amber
    angle: 120,
    iconPath: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
  },
  {
    id: "risk_ageing",
    title: "Risk & Ageing",
    subtitle: "Escalation Matrix",
    color: "#F43F5E", // Rose / Coral
    angle: 180,
    iconPath: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  },
  {
    id: "executive_review",
    title: "Executive Review",
    subtitle: "Management Cadence",
    color: "#8B5CF6", // Purple / Violet
    angle: 240,
    iconPath: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
  },
];

export const CentralGovernanceWheel: React.FC = () => {
  const [activeSegment, setActiveSegment] = useState<string | null>(null);

  // Geometry constants
  const size = 480;
  const center = size / 2;
  const radius = 175;
  const nodeRadius = 38;

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <Box
        sx={{
          width: { xs: 320, sm: 420, md: 480 },
          height: { xs: 320, sm: 420, md: 480 },
          position: "relative",
        }}
      >
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width="100%"
          height="100%"
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Center Radial Soft White-to-Mint Glow */}
            <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="70%" stopColor="#F0FDF4" />
              <stop offset="100%" stopColor="#E6F4EA" />
            </radialGradient>

            {/* ProTap Brand Gradient */}
            <linearGradient id="pratapBrandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="100%" stopColor="#0891B2" />
            </linearGradient>

            {/* Ambient Backdrop Blur */}
            <filter id="ambientBlur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="24" />
            </filter>

            {/* Crisp Node Drop Shadow */}
            <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#0F172A" floodOpacity="0.08" />
            </filter>

            {/* Center Core Soft Shadow */}
            <filter id="centerShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#059669" floodOpacity="0.12" />
            </filter>

            {/* ProTap Emerald Flow Arrow Marker */}
            <marker
              id="arrowHead"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#059669" opacity="0.85" />
            </marker>
          </defs>

          {/* Soft Emerald Ambient Wash */}
          <circle
            cx={center}
            cy={center}
            r={195}
            fill="#ECFDF5"
            opacity="0.65"
          />

          {/* Outer Concentric Guideline Rings */}
          <circle
            cx={center}
            cy={center}
            r={radius + 42}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="1.5"
            strokeDasharray="4 8"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#A7F3D0"
            strokeWidth="1.5"
            strokeDasharray="6 6"
          />
          <circle
            cx={center}
            cy={center}
            r={radius - 50}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="1"
          />

          {/* Directional Circular Flow Arc with Arrowheads */}
          <path
            d={`M ${center + radius} ${center} A ${radius} ${radius} 0 1 1 ${center + radius - 0.01} ${center}`}
            fill="none"
            stroke="url(#pratapBrandGradient)"
            strokeWidth="2.5"
            strokeDasharray="40 80"
            strokeOpacity="0.65"
            markerEnd="url(#arrowHead)"
          />

          {/* Spokes / Connecting Rays to Center */}
          {SEGMENTS.map((seg) => {
            const rad = (seg.angle * Math.PI) / 180;
            const x = center + radius * Math.cos(rad);
            const y = center + radius * Math.sin(rad);
            const isHovered = activeSegment === seg.id;

            return (
              <line
                key={`spoke-${seg.id}`}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke={isHovered ? seg.color : "#CBD5E1"}
                strokeWidth={isHovered ? 2.5 : 1.2}
                strokeDasharray={isHovered ? undefined : "3 5"}
                opacity={isHovered ? 0.95 : 0.6}
                style={{ transition: "all 0.3s ease" }}
              />
            );
          })}

          {/* Central Circular Engine Core */}
          <circle
            cx={center}
            cy={center}
            r={76}
            fill="url(#centerGlow)"
            stroke="url(#pratapBrandGradient)"
            strokeWidth="2.5"
            filter="url(#centerShadow)"
          />

          {/* Inner Accent Ring */}
          <circle
            cx={center}
            cy={center}
            r={66}
            fill="none"
            stroke="rgba(5, 150, 105, 0.25)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Center Brand Text */}
          <text
            x={center}
            y={center - 10}
            textAnchor="middle"
            fill="#0F172A"
            fontSize="24"
            fontWeight="900"
            letterSpacing="2"
          >
            PAGMS
          </text>
          <text
            x={center}
            y={center + 12}
            textAnchor="middle"
            fill="#059669"
            fontSize="9.5"
            fontWeight="800"
            letterSpacing="1.8"
          >
            GOVERNANCE
          </text>
          <text
            x={center}
            y={center + 26}
            textAnchor="middle"
            fill="#0891B2"
            fontSize="7.5"
            fontWeight="700"
            letterSpacing="1"
          >
            CLOSED-LOOP ENGINE
          </text>

          {/* Surrounding Orbital Nodes */}
          {SEGMENTS.map((seg) => {
            const rad = (seg.angle * Math.PI) / 180;
            const x = center + radius * Math.cos(rad);
            const y = center + radius * Math.sin(rad);
            const isHovered = activeSegment === seg.id;

            return (
              <g
                key={seg.id}
                onMouseEnter={() => setActiveSegment(seg.id)}
                onMouseLeave={() => setActiveSegment(null)}
                style={{ cursor: "pointer", transition: "transform 0.25s ease" }}
                transform={isHovered ? `scale(1.08) translate(${-x * 0.08}, ${-y * 0.08})` : undefined}
              >
                {/* Node Outer Glow Halo */}
                {isHovered && (
                  <circle
                    cx={x}
                    cy={y}
                    r={nodeRadius + 8}
                    fill={seg.color}
                    opacity="0.18"
                    filter="url(#ambientBlur)"
                  />
                )}

                {/* Node Background Disc */}
                <circle
                  cx={x}
                  cy={y}
                  r={nodeRadius}
                  fill="#FFFFFF"
                  stroke={isHovered ? seg.color : "#CBD5E1"}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  filter="url(#nodeShadow)"
                />

                {/* Segment Color Pill Underlay */}
                <circle
                  cx={x}
                  cy={y}
                  r={nodeRadius - 6}
                  fill={seg.color}
                  opacity={isHovered ? 0.18 : 0.08}
                />

                {/* Node Icon */}
                <g transform={`translate(${x - 12}, ${y - 18})`}>
                  <path d={seg.iconPath} fill={seg.color} transform="scale(1)" />
                </g>

                {/* Node Title Label */}
                <text
                  x={x}
                  y={y + 11}
                  textAnchor="middle"
                  fill="#0F172A"
                  fontSize="8.5"
                  fontWeight="700"
                >
                  {seg.title}
                </text>

                {/* Node Subtitle */}
                <text
                  x={x}
                  y={y + 22}
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="6.8"
                  fontWeight="600"
                >
                  {seg.subtitle}
                </text>
              </g>
            );
          })}
        </svg>
      </Box>

      {/* Subtitle / Interactive Helper */}
      <Box sx={{ mt: 1, textAlign: "center" }}>
        <Typography
          variant="caption"
          sx={{
            color: "#64748B",
            fontSize: "0.76rem",
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Continuous Closed-Loop Governance Cycle
        </Typography>
      </Box>
    </Box>
  );
};
