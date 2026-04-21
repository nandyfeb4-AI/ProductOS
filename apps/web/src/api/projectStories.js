import { getCachedJson, getJson, invalidateCachedJson, patchJson, postJson } from "./client";

export const createProjectStory = (body) =>
  postJson("/api/project-stories", body).then((story) => {
    invalidateCachedJson([
      "project-stories:",
      "project-story:",
      body?.project_id ? `project:${body.project_id}` : "",
      "projects:",
    ].filter(Boolean));
    return story;
  });

export const getProjectStories = (projectId, sourceFeatureId = null, status = null, sourceStoryId = null) => {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (sourceFeatureId) params.set("source_feature_id", sourceFeatureId);
  if (sourceStoryId) params.set("source_story_id", sourceStoryId);
  if (status) params.set("status", status);
  const query = params.toString();
  return getCachedJson(`/api/project-stories${query ? `?${query}` : ""}`, {
    cacheKey: `project-stories:${projectId ?? "all"}:${sourceFeatureId ?? "none"}:${sourceStoryId ?? "none"}:${status ?? "all"}`,
    ttlMs: 60_000,
  });
};

export const getProjectStory = (storyId) =>
  getCachedJson(`/api/project-stories/${storyId}`, {
    cacheKey: `project-story:${storyId}`,
    ttlMs: 60_000,
  });

export const updateProjectStory = (storyId, body) =>
  patchJson(`/api/project-stories/${storyId}`, body).then((story) => {
    invalidateCachedJson(["project-stories:", `project-story:${storyId}`, "projects:"]);
    return story;
  });
