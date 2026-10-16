import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import LastPageIcon from "@mui/icons-material/LastPage";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { SlideItem } from "../types/slide.types";

interface SlideNavigationControlsProps {
  totalSlides: number;
  currentSlideIndex: number;
  slides: SlideItem[];
  isPlaying: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFirst: () => void;
  onLast: () => void;
  onJumpToSlide: (index: number) => void;
  onTogglePlay: () => void;
}

export const SlideNavigationControls: React.FC<SlideNavigationControlsProps> = ({
  totalSlides,
  currentSlideIndex,
  slides,
  isPlaying,
  onPrev,
  onNext,
  onFirst,
  onLast,
  onJumpToSlide,
  onTogglePlay,
}) => {
  const progressPercent = totalSlides > 0 ? ((currentSlideIndex + 1) / totalSlides) * 100 : 0;

  return (
    <Box
      sx={{
        mt: 2.5,
        p: 2,
        bgcolor: "#FFFFFF",
        border: `1px solid ${colorTokens.workspace.border}`,
        borderRadius: radiusTokens.lg,
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        justifyContent: "space-between",
        alignItems: "center",
        gap: 2,
      }}
    >
      {/* Left: Quick jump & status */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: { xs: "100%", sm: "auto" } }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.secondary, whiteSpace: "nowrap" }}>
          Jump to Slide:
        </Typography>
        <Select
          size="small"
          value={totalSlides > 0 ? currentSlideIndex : ""}
          onChange={(e) => onJumpToSlide(Number(e.target.value))}
          sx={{
            borderRadius: radiusTokens.md,
            fontSize: "0.82rem",
            minWidth: 160,
            maxWidth: 240,
            "& .MuiSelect-select": { py: 0.75 },
          }}
        >
          {slides.map((s, idx) => (
            <MenuItem key={s.slide_id} value={idx}>
              Slide {s.slide_number}: {s.title}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* Center: Progress Bar and Progress Text */}
      <Box sx={{ flex: "1 1 200px", maxWidth: 360, width: "100%", mx: { xs: 0, sm: 2 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>
            SLIDE PROGRESS
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.primary, fontWeight: 700 }}>
            {totalSlides > 0 ? currentSlideIndex + 1 : 0} of {totalSlides}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{
            height: 6,
            borderRadius: radiusTokens.full,
            bgcolor: colorTokens.workspace.borderSubtle,
            "& .MuiLinearProgress-bar": {
              bgcolor: colorTokens.primary.main,
              borderRadius: radiusTokens.full,
            },
          }}
        />
      </Box>

      {/* Right: Previous / Play / Next Controls */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Tooltip title="First Slide (Home)">
          <span>
            <IconButton
              size="small"
              onClick={onFirst}
              disabled={totalSlides <= 1 || currentSlideIndex === 0}
              sx={{ color: colorTokens.text.secondary }}
            >
              <FirstPageIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Previous Slide (← Left Arrow)">
          <span>
            <Button
              variant="outlined"
              size="small"
              onClick={onPrev}
              disabled={totalSlides <= 1}
              startIcon={<ArrowBackIosNewIcon sx={{ fontSize: "14px !important" }} />}
              sx={{
                borderRadius: radiusTokens.md,
                fontWeight: 600,
                fontSize: "0.82rem",
                textTransform: "none",
                borderColor: colorTokens.workspace.border,
                color: colorTokens.text.primary,
                "&:hover": { borderColor: colorTokens.primary.main, bgcolor: colorTokens.workspace.borderSubtle },
              }}
            >
              Previous
            </Button>
          </span>
        </Tooltip>

        <Tooltip title={isPlaying ? "Pause Slideshow (Space)" : "Play Slideshow (Space)"}>
          <IconButton
            size="small"
            onClick={onTogglePlay}
            disabled={totalSlides <= 1}
            sx={{
              bgcolor: isPlaying ? colorTokens.primary.lighter : colorTokens.workspace.background,
              color: isPlaying ? colorTokens.primary.main : colorTokens.text.secondary,
              border: `1px solid ${colorTokens.workspace.border}`,
              "&:hover": { bgcolor: colorTokens.primary.lighter, color: colorTokens.primary.main },
            }}
          >
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Next Slide (→ Right Arrow)">
          <span>
            <Button
              variant="contained"
              size="small"
              onClick={onNext}
              disabled={totalSlides <= 1}
              endIcon={<ArrowForwardIosIcon sx={{ fontSize: "14px !important" }} />}
              sx={{
                borderRadius: radiusTokens.md,
                fontWeight: 600,
                fontSize: "0.82rem",
                textTransform: "none",
                bgcolor: colorTokens.primary.main,
                color: "#FFFFFF",
                "&:hover": { bgcolor: colorTokens.primary.dark },
              }}
            >
              Next
            </Button>
          </span>
        </Tooltip>

        <Tooltip title="Last Slide (End)">
          <span>
            <IconButton
              size="small"
              onClick={onLast}
              disabled={totalSlides <= 1 || currentSlideIndex === totalSlides - 1}
              sx={{ color: colorTokens.text.secondary }}
            >
              <LastPageIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
};
