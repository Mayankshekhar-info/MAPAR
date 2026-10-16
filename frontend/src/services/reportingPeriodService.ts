import { api } from "./api";
import { ReportingPeriod } from "../types/period.types";

export interface PeriodListResponse {
  current_period: ReportingPeriod | null;
  periods: ReportingPeriod[];
  supported_frequencies: string[];
}

export const reportingPeriodService = {
  async fetchPeriods(frequency?: string): Promise<PeriodListResponse> {
    const params: Record<string, string> = {};
    if (frequency && frequency !== "ALL") {
      params.frequency = frequency;
    }
    const res = await api.get<PeriodListResponse>("/reporting/periods/", { params });
    return res.data;
  },

  async resolvePeriod(params: {
    period_id?: number;
    period_type?: string;
    start_date?: string;
    end_date?: string;
    period_name?: string;
  }): Promise<ReportingPeriod> {
    const res = await api.post<ReportingPeriod>("/reporting/periods/resolve/", params);
    return res.data;
  },
};
