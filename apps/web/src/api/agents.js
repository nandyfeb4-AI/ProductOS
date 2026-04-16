import { getJson, postJson } from "./client";

export const runFeatureGenerator = (body) =>
  postJson("/api/agents/feature-generator", body);

export const startFeatureGeneratorJob = (body) =>
  postJson("/api/jobs/feature-generation", body);

export const getGenerationJob = (jobId) =>
  getJson(`/api/jobs/${jobId}`);

