import { getJson, patchJson, postJson } from "./client";

export const createWorkshop = (body) =>
  postJson("/api/workshops", body);

export const getWorkshops = (projectId = null, status = null) => {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (status) params.set("status", status);
  const query = params.toString();
  return getJson(`/api/workshops${query ? `?${query}` : ""}`);
};

export const getWorkshop = (workshopId) =>
  getJson(`/api/workshops/${workshopId}`);

export const updateWorkshop = (workshopId, body) =>
  patchJson(`/api/workshops/${workshopId}`, body);
