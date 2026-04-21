import { getCachedJson, getJson, invalidateCachedJson, patchJson, postJson } from "./client";

export const getProjects = (status = null) =>
  getCachedJson(`/api/projects${status ? `?status=${encodeURIComponent(status)}` : ""}`, {
    cacheKey: `projects:${status ?? "all"}`,
    ttlMs: 60_000,
  });

export const getProject = (projectId) =>
  getCachedJson(`/api/projects/${projectId}`, {
    cacheKey: `project:${projectId}`,
    ttlMs: 60_000,
  });

export const getProjectTeam = (projectId) =>
  getCachedJson(`/api/projects/${projectId}/team`, {
    cacheKey: `project-team:${projectId}`,
    ttlMs: 120_000,
  });

export const createProject = (body) =>
  postJson("/api/projects", body).then((project) => {
    invalidateCachedJson(["projects:", "project:"]);
    return project;
  });

export const updateProject = (projectId, body) =>
  patchJson(`/api/projects/${projectId}`, body).then((project) => {
    invalidateCachedJson([
      "projects:",
      `project:${projectId}`,
      `project-team:${projectId}`,
    ]);
    return project;
  });
