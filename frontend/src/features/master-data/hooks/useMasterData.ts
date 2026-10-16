import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { masterDataService } from "../api/masterDataService";
import { MasterDataFilterState, UploadMasterDataPayload } from "../types/masterData.types";

export const MASTER_DATA_QUERY_KEYS = {
  meta: ["master-data", "meta"] as const,
  records: (filters: Partial<MasterDataFilterState>) => ["master-data", "records", filters] as const,
  record: (id: number) => ["master-data", "record", id] as const,
};

export const useMasterDataMeta = () => {
  return useQuery({
    queryKey: MASTER_DATA_QUERY_KEYS.meta,
    queryFn: () => masterDataService.getMeta(),
    staleTime: 5 * 60 * 1000,
  });
};

export const useMasterDataRecords = (filters: Partial<MasterDataFilterState>) => {
  return useQuery({
    queryKey: MASTER_DATA_QUERY_KEYS.records(filters),
    queryFn: () => masterDataService.getRecords(filters),
    placeholderData: (previousData) => previousData,
  });
};

export const useMasterDataRecord = (id: number | null) => {
  return useQuery({
    queryKey: id ? MASTER_DATA_QUERY_KEYS.record(id) : [],
    queryFn: () => (id ? masterDataService.getRecord(id) : Promise.reject("No ID")),
    enabled: Boolean(id),
  });
};

export const useUpdateMasterDataRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rawData }: { id: number; rawData: Record<string, any> }) =>
      masterDataService.updateRecord(id, rawData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "records"] });
    },
  });
};

export const useUploadMasterData = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UploadMasterDataPayload) => masterDataService.uploadExcel(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data"] });
    },
  });
};
