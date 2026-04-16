import { postJson, getJson } from "./client";

const JIRA_CACHE_KEY = "jira_connection_cache_v1";

export function readJiraConnectionCache() {
  try {
    return JSON.parse(localStorage.getItem(JIRA_CACHE_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function writeJiraConnectionCache(value) {
  try {
    if (!value) localStorage.removeItem(JIRA_CACHE_KEY);
    else localStorage.setItem(JIRA_CACHE_KEY, JSON.stringify(value));
  } catch {
    // Ignore cache write failures.
  }
}

export function clearJiraConnectionCache() {
  try {
    localStorage.removeItem(JIRA_CACHE_KEY);
  } catch {
    // Ignore cache clear failures.
  }
}

export const getJiraAuthorization = () =>
  getJson("/api/connectors/jira/connect");

export const getJiraStatus = () =>
  getJson("/api/connectors/jira/status");

export const disconnectJira = () =>
  postJson("/api/connectors/jira/disconnect", {});

// Authenticate with a Jira / Atlassian workspace using email + API token
export const connectJira = (body) =>
  postJson("/api/connectors/jira/connect", body);

// List projects accessible in the connected workspace
export const getJiraProjects = () =>
  getJson("/api/connectors/jira/projects");

// Push approved stories into the selected Jira project
export const exportToJira = (body) =>
  postJson("/api/jira/export", body);

// Push a single generated feature into the selected Jira project
export const exportFeatureToJira = (body) =>
  postJson("/api/jira/export-feature", body);
