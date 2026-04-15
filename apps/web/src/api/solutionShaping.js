import { postJson } from "./client";

// Get AI-recommended solution shape for each approved opportunity
export const shapeOpportunities = (body) =>
  postJson("/api/solution-shaping/synthesize", body);

// Confirm PM decisions and trigger downstream artifact generation
export const confirmShaping = (body) =>
  postJson("/api/solution-shaping/confirm", body);
