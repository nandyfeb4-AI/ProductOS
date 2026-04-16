import { getJson, patchJson, postJson } from "./client";

export const createProjectStory = (body) =>
  postJson("/api/project-stories", body);

export const getProjectStories = (projectId, sourceFeatureId = null, status = null) => {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (sourceFeatureId) params.set("source_feature_id", sourceFeatureId);
  if (status) params.set("status", status);
  const query = params.toString();
  return getJson(`/api/project-stories${query ? `?${query}` : ""}`);
};

export const getProjectStory = (storyId) =>
  getJson(`/api/project-stories/${storyId}`);

export const updateProjectStory = (storyId, body) =>
  patchJson(`/api/project-stories/${storyId}`, body);
