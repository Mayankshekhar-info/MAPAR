import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import RefreshIcon from "@mui/icons-material/Refresh";
import SlideshowIcon from "@mui/icons-material/Slideshow";
import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { SlidePeriodInfo, SlideDeckSummary } from "../types/slide.types";

interface SlideHeaderProps {
  period?: SlidePeriodInfo;
  deckSummary?: SlideDeckSummary;
  totalSlides: number;
  currentSlideIndex: number;
  isPlaying: boolean;
  isFullscreen: boolean;
  onTogglePlay: () => void;
  onToggleFullscreen: () => void;
  onRefresh: () => void;
  isFetching?: boolean;
}

export const SlideHeader: React.FC<SlideHeaderProps> = ({
  period,
  deckSummary,
  totalSlides,
  currentSlideIndex,
  isPlaying,
  isFullscreen,
  onTogglePlay,
  onToggleFullscreen,
  onRefresh,
  isFetching,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        justifyContent: "space-between",
        alignItems: { xs: "flex-start", md: "center" },
        gap: 2,
        pb: 2.5,
        borderBottom: `1px solid ${colorTokens.workspace.border}`,
        mb: 2.5,
      }}
    >
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: radiusTokens.md,
              bgcolor: colorTokens.primary.lighter,
              color: colorTokens.primary.main,
            }}
          >
            <SlideshowIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: colorTokens.text.primary,
                fontSize: { xs: "1.35rem", md: "1.55rem" },
                letterSpacing: "-0.02em",
                display: "flex",
                alignItems: "center",
                gap: 1.5,
              }}
            >
              Slide View
              {period && (
                <Chip
                  label={period.name}
                  size="small"
                  sx={{
                    bgcolor: colorTokens.workspace.background,
                    border: `1px solid ${colorTokens.workspace.border}`,
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    color: colorTokens.text.secondary,
                    borderRadius: radiusTokens.sm,
                  }}
                />
              )}
              {totalSlides > 0 && (
                <Chip
                  label={`Slide ${currentSlideIndex + 1} of ${totalSlides}`}
                  size="small"
                  sx={{
                    bgcolor: colorTokens.primary.lighter,
                    color: colorTokens.primary.darker,
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    borderRadius: radiusTokens.sm,
                  }}
                />
              )}
            </Typography>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
              Operational control presentation and inspection deck across authorized Circles and Domains
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Control Actions */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        {totalSlides > 1 && (
          <Button
            variant={isPlaying ? "contained" : "outlined"}
            size="small"
            onClick={onTogglePlay}
            startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            sx={{
              borderRadius: radiusTokens.md,
              fontWeight: 600,
              fontSize: "0.82rem",
              textTransform: "none",
              bgcolor: isPlaying ? colorTokens.primary.main : "#FFFFFF",
              color: isPlaying ? "#FFFFFF" : colorTokens.text.primary,
              borderColor: colorTokens.workspace.border,
              boxShadow: isPlaying ? shadowTokens.subtle : "none",
              "&:hover": {
                bgcolor: isPlaying ? colorTokens.primary.dark : colorTokens.workspace.borderSubtle,
                borderColor: colorTokens.primary.main,
              },
            }}
          >
            {isPlaying ? "Pause Deck" : "Auto-Play Deck"}
          </Button>
        )}

        <Button
          variant="outlined"
          size="small"
          onClick={onToggleFullscreen}
          startIcon={isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          sx={{
            borderRadius: radiusTokens.md,
            fontWeight: 600,
            fontSize: "0.82rem",
            textTransform: "none",
            bgcolor: "#FFFFFF",
            color: colorTokens.text.primary,
            borderColor: colorTokens.workspace.border,
            "&:hover": {
              borderColor: colorTokens.primary.main,
              bgcolor: colorTokens.workspace.borderSubtle,
            },
          }}
        >
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen Deck"}
        </Button>

        <Button
          variant="outlined"
          size="small"
          onClick={onRefresh}
          disabled={isFetching}
          startIcon={<RefreshIcon sx={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />}
          sx={{
            borderRadius: radiusTokens.md,
            fontWeight: 600,
            fontSize: "0.82rem",
            textTransform: "none",
            bgcolor: "#FFFFFF",
            color: colorTokens.text.primary,
            borderColor: colorTokens.workspace.border,
            "&:hover": {
              borderColor: colorTokens.primary.main,
              bgcolor: colorTokens.workspace.borderSubtle,
            },
          }}
        >
          Refresh
        </Button>
      </Box>
    </Box>
  );
};
