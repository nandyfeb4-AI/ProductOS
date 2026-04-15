import { postJson } from "./client";

// Generate initiative / feature / enhancement drafts from shaped solutions
export const generateArtifacts = (body) =>
  postJson("/api/artifacts/generate", body);

// Persist approval decisions; returns only approved artifacts for downstream slicing
export const approveArtifacts = (body) =>
  postJson("/api/artifacts/approve", body);
