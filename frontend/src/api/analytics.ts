import { api } from "./client";

export interface Kpis {
  total_os: number;
  total_draft: number;
  total_valid: number;
  total_in_progress: number;
  total_waiting_review: number;
  total_approved: number;
  total_issued: number;
  total_closed: number;
  total_cancelled: number;
  avg_close_days: number | string;
  total_hours?: number | string;
}

export interface StatusCount { status: string; qty: number }
export interface TechCount { technician_id: number; name: string; os_qty: number }
export interface TechHours { technician_id: number; technician_name: string; total_hours: number | string }
export interface CustomerCount { id: number; name: string; os_qty: number }
export interface SiteCount { id: number; site_name: string; os_qty: number }
export interface MonthQty { month_ref: string; qty: number }

export interface AnalyticsPayload {
  kpis: Kpis;
  tables: {
    ordersByStatus: StatusCount[];
    ordersByTechnician: TechCount[];
    hoursByTechnician: TechHours[];
    topCustomers: CustomerCount[];
    topSites: SiteCount[];
    signatureStatus: StatusCount[];
    [key: string]: unknown[];
  };
  monthlyTrend: { opened: MonthQty[]; closed: MonthQty[] };
}

export function getAnalytics() {
  return api<AnalyticsPayload>("/analytics");
}
