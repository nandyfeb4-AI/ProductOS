import { getCachedJson, getJson, invalidateCachedJson, patchJson, postJson } from "./client";

export const createWorkshop = (body) =>
  postJson("/api/workshops", body).then((workshop) => {
    invalidateCachedJson([
      "workshops:",
      "workshop:",
      body?.project_id ? `project:${body.project_id}` : "",
      body?.project_id ? "projects:" : "",
    ].filter(Boolean));
    return workshop;
  });

export const getWorkshops = (projectId = null, status = null) => {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (status) params.set("status", status);
  const query = params.toString();
  return getCachedJson(`/api/workshops${query ? `?${query}` : ""}`, {
    cacheKey: `workshops:${projectId ?? "all"}:${status ?? "all"}`,
    ttlMs: 60_000,
  });
};

export const getWorkshop = (workshopId) =>
  getCachedJson(`/api/workshops/${workshopId}`, {
    cacheKey: `workshop:${workshopId}`,
    ttlMs: 60_000,
  });

export const updateWorkshop = (workshopId, body) =>
  patchJson(`/api/workshops/${workshopId}`, body).then((workshop) => {
    invalidateCachedJson(["workshops:", `workshop:${workshopId}`, "projects:"]);
    return workshop;
  });
