import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { slideService } from "../api/slideService";
import { SlideFilterState, SlideItem } from "../types/slide.types";

export const SLIDE_QUERY_KEYS = {
  filters: ["slides", "filters"] as const,
  deck: (filters: Partial<SlideFilterState>) => ["slides", "deck", filters] as const,
  record: (recordId: number | null) => ["slides", "record", recordId] as const,
};

export function useSlideView() {
  // Filter state
  const [filters, setFilters] = useState<SlideFilterState>({
    companyId: undefined,
    projectId: undefined,
    circleId: undefined,
    domainId: undefined,
    periodId: undefined,
    status: "ALL",
    search: "",
  });

  // Current active slide index (0-based)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Presentation modes
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Deep record drawer inspection
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 1. Fetch dynamic filters from real database records
  const {
    data: filtersData,
    isLoading: isLoadingFilters,
    error: filtersError,
  } = useQuery({
    queryKey: SLIDE_QUERY_KEYS.filters,
    queryFn: slideService.getFilters,
    staleTime: 5 * 60 * 1000,
  });

  // Auto-set current active period once filters are loaded
  useEffect(() => {
    if (filtersData?.periods && filters.periodId === undefined) {
      const current = filtersData.periods.find((p) => p.is_current) || filtersData.periods[0];
      if (current) {
        setFilters((prev) => ({ ...prev, periodId: current.id }));
      }
    }
  }, [filtersData, filters.periodId]);

  // 2. Fetch slide deck
  const {
    data: deckData,
    isLoading: isLoadingDeck,
    isFetching: isFetchingDeck,
    error: deckError,
    refetch: refetchDeck,
  } = useQuery({
    queryKey: SLIDE_QUERY_KEYS.deck(filters),
    queryFn: () => slideService.getSlideDeck(filters),
    staleTime: 60 * 1000,
  });

  // 3. Fetch Deep Record Detail for selected KPI
  const { data: deepRecord, isLoading: isLoadingDeepRecord } = useQuery({
    queryKey: SLIDE_QUERY_KEYS.record(selectedRecordId),
    queryFn: () => {
      if (selectedRecordId === null) return Promise.resolve(null);
      return slideService.getRecordDetail(selectedRecordId);
    },
    enabled: selectedRecordId !== null,
    staleTime: 60 * 1000,
  });

  const slides: SlideItem[] = useMemo(() => deckData?.slides || [], [deckData]);
  const totalSlides = slides.length;

  // Clamp currentSlideIndex if slides count changes
  useEffect(() => {
    if (currentSlideIndex >= totalSlides && totalSlides > 0) {
      setCurrentSlideIndex(0);
    }
  }, [totalSlides, currentSlideIndex]);

  const currentSlide: SlideItem | null = useMemo(() => {
    if (totalSlides === 0 || currentSlideIndex < 0 || currentSlideIndex >= totalSlides) {
      return null;
    }
    return slides[currentSlideIndex];
  }, [slides, currentSlideIndex, totalSlides]);

  // Navigation handlers
  const goToNextSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev + 1 < totalSlides ? prev + 1 : 0));
  }, [totalSlides]);

  const goToPrevSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev - 1 >= 0 ? prev - 1 : totalSlides - 1));
  }, [totalSlides]);

  const goToSlide = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSlides) {
        setCurrentSlideIndex(index);
      }
    },
    [totalSlides]
  );

  const goToFirstSlide = useCallback(() => {
    setCurrentSlideIndex(0);
  }, []);

  const goToLastSlide = useCallback(() => {
    if (totalSlides > 0) {
      setCurrentSlideIndex(totalSlides - 1);
    }
  }, [totalSlides]);

  // Autoplay slideshow timer
  useEffect(() => {
    if (!isPlaying || totalSlides <= 1) return;
    const interval = setInterval(() => {
      goToNextSlide();
    }, 6000);
    return () => clearInterval(interval);
  }, [isPlaying, totalSlides, goToNextSlide]);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goToNextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goToPrevSlide();
      } else if (e.key === "Home") {
        e.preventDefault();
        goToFirstSlide();
      } else if (e.key === "End") {
        e.preventDefault();
        goToLastSlide();
      } else if (e.key === " " && !e.repeat) {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === "f" || e.key === "F") {
        if (!e.ctrlKey && !e.metaKey) {
          setIsFullscreen((prev) => !prev);
        }
      } else if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNextSlide, goToPrevSlide, goToFirstSlide, goToLastSlide, isFullscreen]);

  const navigate = useNavigate();

  // Deep record inspector handler (navigates to proper route)
  const handleOpenRecordDetail = useCallback((recordId: number) => {
    navigate(`/slides/detail/${recordId}`);
  }, [navigate]);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedRecordId(null);
  }, []);

  // Filter setters with cascading reset
  const setCompanyFilter = useCallback((companyId?: number) => {
    setFilters((prev) => ({
      ...prev,
      companyId,
      projectId: undefined,
      circleId: undefined,
    }));
    setCurrentSlideIndex(0);
  }, []);

  const setProjectFilter = useCallback((projectId?: number) => {
    setFilters((prev) => ({
      ...prev,
      projectId,
      circleId: undefined,
    }));
    setCurrentSlideIndex(0);
  }, []);

  const setCircleFilter = useCallback((circleId?: number) => {
    setFilters((prev) => ({
      ...prev,
      circleId,
    }));
    setCurrentSlideIndex(0);
  }, []);

  const setDomainFilter = useCallback((domainId?: number) => {
    setFilters((prev) => ({
      ...prev,
      domainId,
    }));
    setCurrentSlideIndex(0);
  }, []);

  const setPeriodFilter = useCallback((periodId?: number) => {
    setFilters((prev) => ({
      ...prev,
      periodId,
    }));
    setCurrentSlideIndex(0);
  }, []);

  const setStatusFilter = useCallback((status: string) => {
    setFilters((prev) => ({
      ...prev,
      status,
    }));
    setCurrentSlideIndex(0);
  }, []);

  const setSearchFilter = useCallback((search: string) => {
    setFilters((prev) => ({
      ...prev,
      search,
    }));
    setCurrentSlideIndex(0);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      companyId: undefined,
      projectId: undefined,
      circleId: undefined,
      domainId: undefined,
      periodId: filtersData?.periods?.find((p) => p.is_current)?.id || filtersData?.periods?.[0]?.id,
      status: "ALL",
      search: "",
    });
    setCurrentSlideIndex(0);
  }, [filtersData]);

  return {
    filters,
    filtersData,
    isLoadingFilters,
    filtersError,
    setCompanyFilter,
    setProjectFilter,
    setCircleFilter,
    setDomainFilter,
    setPeriodFilter,
    setStatusFilter,
    setSearchFilter,
    resetFilters,

    deckData,
    slides,
    totalSlides,
    currentSlideIndex,
    currentSlide,
    isLoadingDeck,
    isFetchingDeck,
    deckError,
    refetchDeck,

    goToNextSlide,
    goToPrevSlide,
    goToSlide,
    goToFirstSlide,
    goToLastSlide,

    isPlaying,
    setIsPlaying,
    isFullscreen,
    setIsFullscreen,

    selectedRecordId,
    deepRecord,
    isLoadingDeepRecord,
    isDrawerOpen,
    handleOpenRecordDetail,
    handleCloseDrawer,
  };
}
