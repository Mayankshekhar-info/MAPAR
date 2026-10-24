export type ReportingFrequency =
  | "MONTHLY"
  | "WEEKLY"
  | "QUARTERLY"
  | "YEARLY"
  | "DAILY"
  | "CUSTOM";

export interface ReportingPeriod {
  id: number;
  name: string;
  period_type: ReportingFrequency | string;
  start_date: string;
  end_date: string;
  is_frozen: boolean;
  is_current: boolean;
  created_at?: string;
}

export interface DateRange {
  startDate: string | null;
  endDate: string | null;
}
