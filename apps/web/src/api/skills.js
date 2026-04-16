import { getJson, patchJson, postJson } from "./client";

export const getSkills = (skillType = null, activeOnly = null) => {
  const params = new URLSearchParams();
  if (skillType) params.set("skill_type", skillType);
  if (activeOnly !== null) params.set("active_only", String(activeOnly));
  const query = params.toString();
  return getJson(`/api/skills${query ? `?${query}` : ""}`);
};

export const getSkill = (skillId) =>
  getJson(`/api/skills/${skillId}`);

export const createSkill = (body) =>
  postJson("/api/skills", body);

export const updateSkill = (skillId, body) =>
  patchJson(`/api/skills/${skillId}`, body);
