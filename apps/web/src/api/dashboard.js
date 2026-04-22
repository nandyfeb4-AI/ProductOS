import { getCachedJson } from "./client";

const DASHBOARD_SUMMARY_CACHE_KEY = "dashboard_summary_cache_v1";
const PROJECTS_CACHE_KEY = "api_cache_v1:projects:all";

export const getDashboardSummary = () =>
  getCachedJson("/api/dashboard/summary", {
    cacheKey: DASHBOARD_SUMMARY_CACHE_KEY,
    ttlMs: 30_000,
  });

export function readDashboardSummaryCache() {
  try {
    return JSON.parse(sessionStorage.getItem(`api_cache_v1:${DASHBOARD_SUMMARY_CACHE_KEY}`) ?? "null")?.value ?? null;
  } catch {
    return null;
  }
}

export function writeDashboardSummaryCache(value) {
  try {
    if (!value) sessionStorage.removeItem(`api_cache_v1:${DASHBOARD_SUMMARY_CACHE_KEY}`);
    else sessionStorage.setItem(`api_cache_v1:${DASHBOARD_SUMMARY_CACHE_KEY}`, JSON.stringify({ value, ts: Date.now() }));
  } catch {
    // Ignore cache write failures.
  }
}

export function readProjectsListCache() {
  try {
    return JSON.parse(sessionStorage.getItem(PROJECTS_CACHE_KEY) ?? "null")?.value ?? null;
  } catch {
    return null;
  }
}
