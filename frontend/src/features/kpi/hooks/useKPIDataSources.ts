import { useQuery } from "@tanstack/react-query";
import { kpiService } from "../api/kpiService";

export function useKPIDataSources(selectedDatasetId?: number | null) {
  const datasetsQuery = useQuery({
    queryKey: ["kpi-datasets"],
    queryFn: () => kpiService.fetchDatasets(),
    staleTime: 60000,
  });

  const fieldsQuery = useQuery({
    queryKey: ["kpi-dataset-fields", selectedDatasetId],
    queryFn: () => (selectedDatasetId ? kpiService.fetchDatasetFields(selectedDatasetId) : Promise.resolve([])),
    enabled: Boolean(selectedDatasetId),
    staleTime: 60000,
  });

  return {
    datasets: datasetsQuery.data || [],
    isLoadingDatasets: datasetsQuery.isLoading,
    fields: fieldsQuery.data || [],
    isLoadingFields: fieldsQuery.isLoading,
  };
}
