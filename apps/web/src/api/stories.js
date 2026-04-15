import { postJson } from "./client";

// Slice approved artifacts into implementation-ready story candidates
export const sliceStories = (body) =>
  postJson("/api/stories/slice", body);

// Persist story approval decisions
export const approveStories = (body) =>
  postJson("/api/stories/approve", body);
