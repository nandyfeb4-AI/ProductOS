import { getJson, patchJson, postJson } from "./client";

export const createProjectFeature = (body) =>
  postJson("/api/project-features", body);

export const getProjectFeatures = (projectId, status = null) => {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (status) params.set("status", status);
  const query = params.toString();
  return getJson(`/api/project-features${query ? `?${query}` : ""}`);
};

export const getProjectFeature = (featureId) =>
  getJson(`/api/project-features/${featureId}`);

export const updateProjectFeature = (featureId, body) =>
  patchJson(`/api/project-features/${featureId}`, body);
