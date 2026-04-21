import { getCachedJson, getJson, invalidateCachedJson, patchJson, postJson } from "./client";

export const createProjectFeature = (body) =>
  postJson("/api/project-features", body).then((feature) => {
    invalidateCachedJson([
      "project-features:",
      "project-feature:",
      body?.project_id ? `project:${body.project_id}` : "",
      "projects:",
    ].filter(Boolean));
    return feature;
  });

export const getProjectFeatures = (projectId, status = null) => {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (status) params.set("status", status);
  const query = params.toString();
  return getCachedJson(`/api/project-features${query ? `?${query}` : ""}`, {
    cacheKey: `project-features:${projectId ?? "all"}:${status ?? "all"}`,
    ttlMs: 60_000,
  });
};

export const getProjectFeature = (featureId) =>
  getCachedJson(`/api/project-features/${featureId}`, {
    cacheKey: `project-feature:${featureId}`,
    ttlMs: 60_000,
  });

export const updateProjectFeature = (featureId, body) =>
  patchJson(`/api/project-features/${featureId}`, body).then((feature) => {
    invalidateCachedJson(["project-features:", `project-feature:${featureId}`, "projects:"]);
    return feature;
  });
