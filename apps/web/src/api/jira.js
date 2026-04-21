import { postJson, getJson } from "./client";

const JIRA_CACHE_KEY = "jira_connection_cache_v1";
const JIRA_CACHE_TTL_MS = 10 * 60 * 1000;

function normalizeProjectsResponse(data) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.projects) ? data.projects : [];
}

function normalizeJiraConnectionCache(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    connected: Boolean(raw.connected),
    jiraInfo: raw.jiraInfo ?? null,
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    selectedProject: typeof raw.selectedProject === "string" ? raw.selectedProject : "",
    loadedAt: typeof raw.loadedAt === "number" ? raw.loadedAt : 0,
  };
}

export function readJiraConnectionCache() {
  try {
    return normalizeJiraConnectionCache(
      JSON.parse(localStorage.getItem(JIRA_CACHE_KEY) ?? "null"),
    );
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

export function getCachedJiraConnectionContext() {
  return readJiraConnectionCache();
}

export function persistJiraSelectedProject(selectedProject) {
  const cached = readJiraConnectionCache();
  if (!cached?.connected) return;
  writeJiraConnectionCache({
    ...cached,
    selectedProject: selectedProject ?? "",
  });
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

export async function preloadJiraConnectionContext({ forceRefresh = false } = {}) {
  const cached = readJiraConnectionCache();
  const callbackDone = localStorage.getItem("jira_oauth_connected") === "true";
  const hasFreshCache =
    cached?.connected &&
    Date.now() - (cached.loadedAt ?? 0) < JIRA_CACHE_TTL_MS;

  if (!forceRefresh && hasFreshCache && !callbackDone) {
    return cached;
  }

  try {
    const jiraInfo = await getJiraStatus();
    if (!jiraInfo?.connected) {
      clearJiraConnectionCache();
      return {
        connected: false,
        jiraInfo: null,
        projects: [],
        selectedProject: "",
        loadedAt: Date.now(),
      };
    }

    let projects = cached?.projects ?? [];
    if (
      forceRefresh ||
      callbackDone ||
      !hasFreshCache ||
      !Array.isArray(projects) ||
      projects.length === 0
    ) {
      projects = normalizeProjectsResponse(await getJiraProjects());
    }

    const selectedProject =
      cached?.selectedProject && projects.some((p) => p.key === cached.selectedProject)
        ? cached.selectedProject
        : projects.length === 1
          ? projects[0].key
          : "";

    const next = {
      connected: true,
      jiraInfo,
      projects,
      selectedProject,
      loadedAt: Date.now(),
    };
    writeJiraConnectionCache(next);
    return next;
  } finally {
    if (callbackDone) localStorage.removeItem("jira_oauth_connected");
  }
}
