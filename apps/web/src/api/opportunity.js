import { postJson } from "./client";

// Synthesize opportunity candidates from extracted journey/workshop data
export const synthesizeOpportunities = (body) =>
  postJson("/api/opportunity/synthesize", body);

// Validate / save approved opportunities
export const validateOpportunities = (body) =>
  postJson("/api/opportunity/validate", body);
