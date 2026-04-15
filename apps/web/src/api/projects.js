import { getJson, patchJson, postJson } from "./client";

export const getProjects = (status = null) =>
  getJson(`/api/projects${status ? `?status=${encodeURIComponent(status)}` : ""}`);

export const getProject = (projectId) =>
  getJson(`/api/projects/${projectId}`);

export const createProject = (body) =>
  postJson("/api/projects", body);

export const updateProject = (projectId, body) =>
  patchJson(`/api/projects/${projectId}`, body);
