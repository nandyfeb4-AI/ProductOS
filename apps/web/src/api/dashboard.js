import { getJson } from "./client";

const DASHBOARD_SUMMARY_CACHE_KEY = "dashboard_summary_cache_v1";

export const getDashboardSummary = () => getJson("/api/dashboard/summary");

export function readDashboardSummaryCache() {
  try {
    return JSON.parse(sessionStorage.getItem(DASHBOARD_SUMMARY_CACHE_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function writeDashboardSummaryCache(value) {
  try {
    if (!value) sessionStorage.removeItem(DASHBOARD_SUMMARY_CACHE_KEY);
    else sessionStorage.setItem(DASHBOARD_SUMMARY_CACHE_KEY, JSON.stringify(value));
  } catch {
    // Ignore cache write failures.
  }
}
