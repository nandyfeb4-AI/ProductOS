import { postJson, getJson } from "./client";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

export const startOpportunitySynthesisJob = (body) => postJson("/api/jobs/opportunity-synthesis", body);
export const startSolutionShapingJob      = (body) => postJson("/api/jobs/solution-shaping",       body);
export const startArtifactGenerationJob   = (body) => postJson("/api/jobs/artifact-generation",    body);
export const startStorySlicingJob         = (body) => postJson("/api/jobs/story-slicing",          body);

export const getJob = (jobId) => getJson(`/api/jobs/${jobId}`);

/** Opens a WebSocket for real-time job progress events. */
export const openJobSocket = (jobId) => new WebSocket(`${WS_BASE}/api/jobs/ws/${jobId}`);
