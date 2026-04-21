import { getJson, postJson, patchJson } from "./client";

export const createWorkflow = (body) => postJson("/api/workflows", body);
export const getWorkflows = (type = "workshop", projectId = null, workshopId = null, workflowDefinitionKey = null) => {
  const params = new URLSearchParams();
  if (type) params.set("workflow_type", type);
  if (workflowDefinitionKey) params.set("workflow_definition_key", workflowDefinitionKey);
  if (projectId) params.set("project_id", projectId);
  if (workshopId) params.set("workshop_id", workshopId);
  const query = params.toString();
  return getJson(`/api/workflows${query ? `?${query}` : ""}`);
};
export const getWorkflow = (id) => getJson(`/api/workflows/${id}`);
export const updateWorkflow = (id, body) => patchJson(`/api/workflows/${id}`, body);
export const getFeatureHardeningSource = (projectKey) =>
  getJson(`/api/workflows/feature-hardening/source?project_key=${encodeURIComponent(projectKey)}`);
export const runFeatureHardening = (body) => postJson("/api/workflows/feature-hardening/run", body);
export const publishFeatureHardening = (body) => postJson("/api/workflows/feature-hardening/publish", body);
export const getBacklogRefinementSource = (projectId, projectKey) =>
  getJson(`/api/workflows/backlog-refinement/source?project_id=${encodeURIComponent(projectId)}&project_key=${encodeURIComponent(projectKey)}`);
export const analyzeBacklogRefinement = (body) => postJson("/api/workflows/backlog-refinement/analyze", body);
export const executeBacklogRefinement = (body) => postJson("/api/workflows/backlog-refinement/execute", body);

// ─── SessionStorage helpers ───────────────────────────────────────────────────

const WORKFLOW_ID_KEY  = "current_workflow_id";
const WORKSHOP_ID_KEY  = "current_workshop_id";
const WORKFLOW_STATUS_KEY = "current_workflow_status";
const WORKFLOW_RESTORE_KEY      = "workflow_restore_pending";
const WORKFLOW_RESTORE_STEP_KEY = "workflow_restore_step";
const BACKLOG_REFINEMENT_RESTORE_KEY = "backlog_refinement_restore_pending";
const FLOWBAR_ORDER = ["workshop", "validation", "shaping", "artifacts", "stories", "jira"];

/** Keys that form the workflow state_payload, in pipeline order. */
const PIPELINE_KEYS = [
  "workshop_pipeline_data",
  "opportunity_pipeline_data",
  "shaping_pipeline_data",
  "artifact_pipeline_data",
  "stories_pipeline_data",
  "jira_pipeline_data",
];

export function storeCurrentWorkflowId(id) {
  if (id) sessionStorage.setItem(WORKFLOW_ID_KEY, id);
  else    sessionStorage.removeItem(WORKFLOW_ID_KEY);
}

export function loadCurrentWorkflowId() {
  return sessionStorage.getItem(WORKFLOW_ID_KEY) ?? null;
}

export function storeCurrentWorkflowStatus(status) {
  if (status) sessionStorage.setItem(WORKFLOW_STATUS_KEY, status);
  else sessionStorage.removeItem(WORKFLOW_STATUS_KEY);
}

export function loadCurrentWorkflowStatus() {
  return sessionStorage.getItem(WORKFLOW_STATUS_KEY) ?? null;
}

export function storeCurrentWorkshopId(id) {
  if (id) sessionStorage.setItem(WORKSHOP_ID_KEY, id);
  else    sessionStorage.removeItem(WORKSHOP_ID_KEY);
}

export function loadCurrentWorkshopId() {
  return sessionStorage.getItem(WORKSHOP_ID_KEY) ?? null;
}

/** Wipes workflow run ID, workshop ID, all pipeline sessionStorage keys, and the restore flag. Call before starting a brand-new workshop. */
export function clearWorkflowState() {
  storeCurrentWorkflowId(null);
  storeCurrentWorkflowStatus(null);
  storeCurrentWorkshopId(null);
  PIPELINE_KEYS.forEach(key => sessionStorage.removeItem(key));
  sessionStorage.removeItem(WORKFLOW_RESTORE_KEY);
  sessionStorage.removeItem(WORKFLOW_RESTORE_STEP_KEY);
  sessionStorage.removeItem(BACKLOG_REFINEMENT_RESTORE_KEY);
}

/**
 * Reads all pipeline sessionStorage keys and PATCHes the current workflow.
 * Fire-and-forget — callers should not await this; failures are logged only.
 */
export function persistWorkflowStep(currentStep, extraPayload = {}) {
  const workflowId = loadCurrentWorkflowId();
  if (!workflowId) return;

  const statePayload = { ...extraPayload };
  PIPELINE_KEYS.forEach(key => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) statePayload[key] = JSON.parse(raw);
    } catch { /* ignore parse errors */ }
  });

  updateWorkflow(workflowId, {
    current_step:  currentStep,
    status:        "active",
    state_payload: statePayload,
  }).catch(err => console.warn("[workflow] PATCH failed:", err));
  storeCurrentWorkflowStatus("active");
}

/**
 * Restores sessionStorage from a workflow's state_payload, then stores its ID
 * as the current workflow. Call before navigating to the resumed step.
 */
export function restoreWorkflowState(workflow) {
  storeCurrentWorkflowId(workflow.id);
  storeCurrentWorkflowStatus(workflow.status ?? "active");
  if (workflow.workshop_id) storeCurrentWorkshopId(workflow.workshop_id);
  const payload = workflow.state_payload ?? {};
  PIPELINE_KEYS.forEach(key => {
    if (payload[key] != null) {
      sessionStorage.setItem(key, JSON.stringify(payload[key]));
    }
  });
  const resumeStep = workflow.current_step === "validation" ? "opportunity" : (workflow.current_step ?? "workshop");
  if (resumeStep === "workshop") {
    sessionStorage.setItem(WORKFLOW_RESTORE_KEY, "true");
    sessionStorage.setItem(WORKFLOW_RESTORE_STEP_KEY, "workshop");
  } else {
    sessionStorage.removeItem(WORKFLOW_RESTORE_KEY);
    sessionStorage.removeItem(WORKFLOW_RESTORE_STEP_KEY);
  }
}

export function getFlowbarCompletedSteps(currentStep) {
  const normalizedStep = currentStep === "opportunity" ? "validation" : currentStep;
  const currentIndex = FLOWBAR_ORDER.indexOf(normalizedStep);
  if (currentIndex < 0) return [];

  const status = loadCurrentWorkflowStatus();
  if (status === "completed") {
    return FLOWBAR_ORDER.filter(step => step !== normalizedStep);
  }

  return FLOWBAR_ORDER.slice(0, currentIndex);
}
