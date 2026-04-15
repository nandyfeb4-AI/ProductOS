import { getJson, postJson } from "./client";

// Step 1: Get OAuth authorization URL + state token
export const getMuralConnectUrl = () =>
  getJson("/api/connectors/mural/connect");

// Step 2: Check connection status after OAuth (use stored state)
export const getMuralStatus = (state) =>
  getJson(`/api/connectors/mural/status?state=${encodeURIComponent(state)}`);

// Step 3: List workspaces
export const getMuralWorkspaces = (state) =>
  getJson(`/api/connectors/mural/workspaces?state=${encodeURIComponent(state)}`);

// Step 4: List murals in a workspace
export const getMuralsInWorkspace = (workspaceId, state) =>
  getJson(`/api/connectors/mural/workspaces/${workspaceId}/murals?state=${encodeURIComponent(state)}`);

// Step 5: Import a mural → returns insights
export const importMural = (muralId, state) =>
  postJson(`/api/connectors/mural/murals/${muralId}/import?state=${encodeURIComponent(state)}`, {});
