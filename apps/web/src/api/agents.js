import { getJson, postJson } from "./client";

export const runFeatureGenerator = (body) =>
  postJson("/api/agents/feature-generator", body);

export const startFeatureGeneratorJob = (body) =>
  postJson("/api/jobs/feature-generation", body);

export const runFeatureRefiner = (body) =>
  postJson("/api/agents/feature-refiner", body);

export const startFeatureRefinementJob = (body) =>
  postJson("/api/jobs/feature-refinement", body);

export const runFeaturePrioritizer = (body) =>
  postJson("/api/agents/feature-prioritizer", body);

export const startFeaturePrioritizationJob = (body) =>
  postJson("/api/jobs/feature-prioritization", body);

export const runStoryGenerator = (body) =>
  postJson("/api/agents/story-generator", body);

export const startStoryGeneratorJob = (body) =>
  postJson("/api/jobs/story-generation", body);

export const runStoryRefiner = (body) =>
  postJson("/api/agents/story-refiner", body);

export const startStoryRefinementJob = (body) =>
  postJson("/api/jobs/story-refinement", body);

export const runStorySlicer = (body) =>
  postJson("/api/agents/story-slicer", body);

export const startStorySlicingAgentJob = (body) =>
  postJson("/api/jobs/story-slicing-agent", body);

export const startFeatureHardeningJob = (body) =>
  postJson("/api/jobs/feature-hardening", body);

export const startBacklogRefinementAnalysisJob = (body) =>
  postJson("/api/jobs/backlog-refinement-analysis", body);

export const startBacklogRefinementExecutionJob = (body) =>
  postJson("/api/jobs/backlog-refinement-execution", body);

export const getGenerationJob = (jobId) =>
  getJson(`/api/jobs/${jobId}`);
