import { useEffect, useMemo, useState } from "react";
import PipelineFlowBar from "../components/pipeline/PipelineFlowBar";
import {
  clearJiraConnectionCache,
  disconnectJira,
  exportToJira,
  getJiraAuthorization,
  getJiraProjects,
  getJiraStatus,
  readJiraConnectionCache,
  writeJiraConnectionCache,
} from "../api/jira";
import {
  getFlowbarCompletedSteps,
  loadCurrentWorkflowId,
  persistWorkflowStep,
  storeCurrentWorkflowStatus,
  updateWorkflow,
} from "../api/workflows";


// ─── Config ───────────────────────────────────────────────────────────────────
const PRIORITY_CFG = {
  high:   "bg-red-50 text-red-600 border border-red-100",
  medium: "bg-amber-50 text-amber-600 border border-amber-100",
  low:    "bg-slate-50 text-slate-500 border border-slate-200",
};

const ARTIFACT_TYPE_CFG = {
  initiative:  { label: "Initiative",  badge: "bg-purple-100 text-purple-700 border-purple-200" },
  feature:     { label: "Feature",     badge: "bg-blue-100 text-blue-700 border-blue-200"       },
  enhancement: { label: "Enhancement", badge: "bg-amber-100 text-amber-700 border-amber-200"    },
};

function readSessionJson(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

// ─── Jira connection card ─────────────────────────────────────────────────────
function JiraConnectorCard({ state, onConnect, error }) {
  const isLoading = state === "checking" || state === "loading_projects";

  return (
    <div className="bg-surface border border-outline rounded-xl p-6 mb-6 shadow-card">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-[#0052CC]/10 border border-[#0052CC]/20 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[22px] text-[#0052CC]">sync_alt</span>
        </div>
        <div>
          <h3 className="text-sm font-headline font-bold text-on-surface">Connect Jira</h3>
          <p className="text-[12px] text-on-surface-variant">
            {isLoading
              ? "Checking connection and loading Jira projects…"
              : "Authenticate with your Atlassian workspace to push stories"}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-error text-[16px]">error</span>
          <p className="text-[12px] text-red-600">{error}</p>
        </div>
      )}

      <button
        onClick={onConnect}
        disabled={state === "connecting" || isLoading}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#0052CC] text-white font-bold text-sm rounded-lg hover:bg-[#0047B3] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === "connecting" || isLoading
          ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <span className="material-symbols-outlined text-[18px]">link</span>}
        {state === "connecting"
          ? "Connecting…"
          : isLoading
            ? "Loading Jira…"
            : "Authorize with Atlassian"}
      </button>
    </div>
  );
}

// ─── Export configuration form (shown after connection) ───────────────────────
function ExportConfig({ projects, selectedProject, exportStrategy, onProjectChange, onStrategyChange }) {
  return (
    <div className="bg-surface border border-outline rounded-xl p-6 mb-6 shadow-card">
      <h3 className="text-sm font-headline font-bold text-on-surface mb-4">Export Configuration</h3>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Target Project
          </label>
          <select
            value={selectedProject}
            onChange={e => onProjectChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface border border-outline rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          >
            <option value="">Select a project…</option>
            {projects.map(p => (
              <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Parent Structure
          </label>
          <select
            value={exportStrategy}
            onChange={e => onStrategyChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface border border-outline rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          >
            <option value="none">Stories only — no epics</option>
            <option value="feature-as-epic">Features as Epics</option>
            <option value="initiative-as-epic">Initiatives as Epics</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function JiraExport({ onNavigate }) {
  const storiesData = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("stories_pipeline_data") ?? "null"); }
    catch { return null; }
  }, []);

  const stories = storiesData?.stories ?? [];

  // Load parent artifacts for display context
  const artifactData = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("artifact_pipeline_data") ?? "null"); }
    catch { return null; }
  }, []);
  const artifacts = artifactData?.artifacts ?? [];

  // Jira connection
  const [jiraState, setJiraState]   = useState("disconnected");
  const [jiraInfo, setJiraInfo]     = useState(null);
  const [connError, setConnError]   = useState(null);

  // Project + strategy
  const [projects, setProjects]               = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [exportStrategy, setExportStrategy]   = useState("feature-as-epic");

  // Export execution
  const [exporting, setExporting]         = useState(false);
  const [exportResults, setExportResults] = useState([]);
  const [exportError, setExportError]     = useState(null);

  useEffect(() => {
    const cached = readJiraConnectionCache();
    if (cached?.connected) {
      setJiraState("connected");
      setJiraInfo(cached.jiraInfo ?? null);
      setProjects(Array.isArray(cached.projects) ? cached.projects : []);
      if (!selectedProject && cached.selectedProject) {
        setSelectedProject(cached.selectedProject);
      }
    } else {
      setJiraState("checking");
    }

    const callbackDone = localStorage.getItem("jira_oauth_connected") === "true";
    if (callbackDone || !cached?.connected) {
      setJiraState("checking");
      getJiraStatus()
        .then(result => {
          if (result.connected) {
            setJiraInfo(result);
            setJiraState("connected");
            writeJiraConnectionCache({
              connected: true,
              jiraInfo: result,
              projects: cached?.projects ?? [],
              selectedProject: cached?.selectedProject ?? "",
            });
            setJiraState("loading_projects");
            return getJiraProjects();
          }
          clearJiraConnectionCache();
          setJiraState("disconnected");
          return null;
        })
        .then(projResult => {
          if (!projResult) return;
          const ps = projResult.projects ?? [];
          setProjects(ps);
          const nextSelectedProject = ps.length === 1
            ? ps[0].key
            : (cached?.selectedProject && ps.some(p => p.key === cached.selectedProject) ? cached.selectedProject : "");
          if (nextSelectedProject) setSelectedProject(nextSelectedProject);
          writeJiraConnectionCache({
            connected: true,
            jiraInfo: cached?.jiraInfo ?? jiraInfo,
            projects: ps,
            selectedProject: nextSelectedProject,
          });
        })
        .catch((e) => {
          setConnError(e.message);
          setJiraState("disconnected");
        })
        .finally(() => {
          if (callbackDone) localStorage.removeItem("jira_oauth_connected");
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConnect() {
    setJiraState("connecting");
    setConnError(null);
    try {
      localStorage.setItem("oauth_jira_origin", "jira");
      const result = await getJiraAuthorization();
      window.location.href = result.authorization_url;
    } catch (e) {
      setConnError(e.message);
      setJiraState("disconnected");
    }
  }

  function handleDisconnect() {
    disconnectJira().catch(() => {});
    setJiraState("disconnected");
    setJiraInfo(null);
    setProjects([]);
    setSelectedProject("");
    setExportResults([]);
    clearJiraConnectionCache();
  }

  async function handleExport() {
    if (!selectedProject) return;
    setExporting(true);
    setExportError(null);
    try {
      const result = await exportToJira({
        project_key:     selectedProject,
        stories,
        parent_strategy: exportStrategy,
        artifacts,
      });
      setExportResults(result.issues ?? []);
      const jiraPayload = {
        project_key: selectedProject,
        parent_strategy: exportStrategy,
        issues: result.issues ?? [],
      };
      sessionStorage.setItem("jira_pipeline_data", JSON.stringify(jiraPayload));
      persistWorkflowStep("jira", { jira_pipeline_data: jiraPayload });

      const workflowId = loadCurrentWorkflowId();
      if (workflowId) {
        await updateWorkflow(workflowId, {
          current_step: "jira",
          status: "completed",
          state_payload: {
            workshop_pipeline_data: readSessionJson("workshop_pipeline_data"),
            opportunity_pipeline_data: readSessionJson("opportunity_pipeline_data"),
            shaping_pipeline_data: readSessionJson("shaping_pipeline_data"),
            artifact_pipeline_data: readSessionJson("artifact_pipeline_data"),
            stories_pipeline_data: readSessionJson("stories_pipeline_data"),
            jira_pipeline_data: jiraPayload,
          },
        });
        storeCurrentWorkflowStatus("completed");
      }
    } catch (e) {
      setExportError(e.message);
    } finally {
      setExporting(false);
    }
  }

  const exportDone = exportResults.length > 0;

  useEffect(() => {
    if (jiraState === "connected") {
      writeJiraConnectionCache({
        connected: true,
        jiraInfo,
        projects,
        selectedProject,
      });
    }
  }, [jiraState, jiraInfo, projects, selectedProject]);

  // Build story → artifact lookup for display
  const artifactById = useMemo(() => {
    const map = {};
    artifacts.forEach(a => { map[a.artifact_id] = a; });
    return map;
  }, [artifacts]);

  return (
    <div>
      <PipelineFlowBar
        currentStep="jira"
        completedSteps={getFlowbarCompletedSteps("jira")}
        onNavigate={onNavigate}
      />

      <div className="px-10 py-10">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1 text-[11px] text-on-surface-variant font-medium">
              <button onClick={() => onNavigate?.("stories")} className="hover:text-primary transition-colors">
                Story Slicing
              </button>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-on-surface font-semibold">Jira Export</span>
            </div>
            <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface mb-2">
              Jira <span className="text-primary">Export</span>
            </h2>
            <p className="text-on-surface-variant text-sm max-w-xl leading-relaxed">
              Push approved stories to Jira. Connect your Atlassian workspace, choose a project, then export.
              Jira is the delivery endpoint — only approved stories reach this step.
            </p>
          </div>

          {/* Connected badge */}
          {jiraState === "connected" && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg shrink-0">
              <span className="material-symbols-outlined text-[16px] text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <div>
                <p className="text-[12px] font-bold text-green-700">Connected</p>
                {jiraInfo?.display_name && (
                  <p className="text-[11px] text-green-600">{jiraInfo.display_name}</p>
                )}
              </div>
              <button
                onClick={handleDisconnect}
                className="ml-2 text-green-600/60 hover:text-error transition-colors"
                title="Disconnect"
              >
                <span className="material-symbols-outlined text-[16px]">link_off</span>
              </button>
            </div>
          )}
        </div>

        {/* ── No stories state ─────────────────────────────────────────── */}
        {stories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-surface border border-outline rounded-xl shadow-card">
            <div className="w-14 h-14 rounded-full bg-surface-container border border-outline flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[28px] text-on-surface-variant">cloud_upload</span>
            </div>
            <h3 className="text-base font-headline font-bold text-on-surface mb-2">No approved stories</h3>
            <p className="text-sm text-on-surface-variant text-center max-w-sm leading-relaxed mb-6">
              Return to Story Slicing and approve at least one story before exporting to Jira.
            </p>
            <button
              onClick={() => onNavigate?.("stories")}
              className="flex items-center gap-2 px-4 py-2 border border-outline rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Stories
            </button>
          </div>
        )}

        {stories.length > 0 && (
          <div className="grid grid-cols-12 gap-8">

            {/* Left: connector + preview ────────────────────────────────── */}
            <div className="col-span-12 lg:col-span-8">

              {/* Connection form */}
              {jiraState !== "connected" && (
                <JiraConnectorCard
                  state={jiraState}
                  onConnect={handleConnect}
                  error={connError}
                />
              )}

              {/* Export config */}
              {jiraState === "connected" && !exportDone && (
                <ExportConfig
                  projects={projects}
                  selectedProject={selectedProject}
                  exportStrategy={exportStrategy}
                  onProjectChange={setSelectedProject}
                  onStrategyChange={setExportStrategy}
                />
              )}

              {/* Preview table */}
              {!exportDone && (
                <div className="bg-surface border border-outline rounded-xl overflow-hidden shadow-card">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-outline">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">preview</span>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Export Preview
                      </span>
                    </div>
                    <span className="text-[11px] text-on-surface-variant">{stories.length} stories</span>
                  </div>
                  <div className="divide-y divide-outline">
                    {stories.map(story => {
                      const priorityClass = PRIORITY_CFG[story.priority ?? "medium"] ?? PRIORITY_CFG.medium;
                      const parentArtifact = artifactById[story.derived_from_artifact_id];
                      const type  = (parentArtifact?.artifact_type ?? "feature").toLowerCase();
                      const aCfg  = ARTIFACT_TYPE_CFG[type] ?? ARTIFACT_TYPE_CFG.feature;
                      // Build the list of Jira description sections this story will include
                      const sections = [
                        (story.as_a || story.i_want || story.so_that || story.user_story)
                          ? "User Story" : null,
                        story.description ? "Description" : null,
                        story.acceptance_criteria?.length > 0
                          ? `${story.acceptance_criteria.length} AC` : null,
                        story.edge_cases?.length > 0
                          ? `${story.edge_cases.length} Edge ${story.edge_cases.length === 1 ? "Case" : "Cases"}` : null,
                        story.dependencies?.length > 0
                          ? `${story.dependencies.length} ${story.dependencies.length === 1 ? "Dep" : "Deps"}` : null,
                      ].filter(Boolean);

                      return (
                        <div key={story.story_id} className="flex items-start gap-3 px-5 py-3.5">
                          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${priorityClass}`}>
                            {story.priority ?? "medium"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-on-surface font-medium truncate">{story.title}</p>
                            {parentArtifact && (
                              <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">
                                ↳ {parentArtifact.title}
                              </p>
                            )}
                            {sections.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                {sections.map(s => (
                                  <span
                                    key={s}
                                    className="text-[10px] font-medium px-1.5 py-0.5 bg-surface-container border border-outline rounded text-on-surface-variant"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {parentArtifact && (
                            <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border mt-0.5 ${aCfg.badge}`}>
                              {aCfg.label}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Results table */}
              {exportDone && (
                <div className="bg-surface border border-green-200 rounded-xl overflow-hidden shadow-card">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-green-200 bg-green-50/40">
                    <span className="material-symbols-outlined text-[20px] text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>
                      task_alt
                    </span>
                    <div>
                      <p className="text-sm font-headline font-bold text-green-700">Export complete</p>
                      <p className="text-[12px] text-green-600">
                        {exportResults.length} issue{exportResults.length === 1 ? "" : "s"} created in {selectedProject}
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-outline">
                    {exportResults.map(issue => {
                      const story = stories.find(s => s.story_id === issue.story_id);
                      return (
                        <div key={issue.story_id} className="flex items-center gap-4 px-5 py-3.5">
                          <span className="shrink-0 font-mono text-[12px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                            {issue.issue_key}
                          </span>
                          <p className="flex-1 text-sm text-on-surface truncate">
                            {story?.title ?? issue.story_id}
                          </p>
                          {issue.issue_url && (
                            <a
                              href={issue.issue_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-dim transition-colors"
                            >
                              View in Jira
                              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {exportError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-error text-[18px] mt-0.5">error</span>
                  <div>
                    <p className="text-sm font-semibold text-red-700">Export failed</p>
                    <p className="text-[12px] text-red-600 mt-0.5">{exportError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: summary + push ────────────────────────────────────── */}
            <div className="col-span-12 lg:col-span-4">
              <div className="bg-surface border border-outline rounded-xl overflow-hidden shadow-card sticky top-[76px]">
                <div className="px-5 py-4 border-b border-outline">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Export Summary
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-container border border-outline rounded-lg p-3 text-center">
                      <p className="text-xl font-headline font-bold text-on-surface">{stories.length}</p>
                      <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Stories</p>
                    </div>
                    <div className={`border rounded-lg p-3 text-center transition-colors ${
                      jiraState === "connected"
                        ? "bg-green-50 border-green-200"
                        : "bg-surface-container border-outline"
                    }`}>
                      <p className={`text-xl font-headline font-bold ${
                        jiraState === "connected" ? "text-green-700" : "text-on-surface-variant"
                      }`}>
                        {jiraState === "connected" ? "✓" : "—"}
                      </p>
                      <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Jira</p>
                    </div>
                  </div>

                  {/* Selected project */}
                  {selectedProject && (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                        Target Project
                      </p>
                      <p className="text-sm font-bold text-primary">
                        {projects.find(p => p.key === selectedProject)?.name ?? selectedProject}
                      </p>
                      <p className="text-[11px] font-mono text-on-surface-variant">{selectedProject}</p>
                    </div>
                  )}

                  {/* Export strategy badge */}
                  {exportStrategy !== "none" && jiraState === "connected" && (
                    <div className="flex items-center gap-2 text-[11px] text-on-surface-variant px-1">
                      <span className="material-symbols-outlined text-[14px]">account_tree</span>
                      <span>{exportStrategy === "feature-as-epic" ? "Features as Epics" : "Initiatives as Epics"}</span>
                    </div>
                  )}
                </div>

                <div className="px-4 pb-4 space-y-2">
                  {!exportDone ? (
                    <button
                      onClick={handleExport}
                      disabled={jiraState !== "connected" || !selectedProject || exporting}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary-dim transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {exporting
                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <span className="material-symbols-outlined text-[18px]">cloud_upload</span>}
                      {exporting ? "Exporting…" : "Push to Jira"}
                    </button>
                  ) : (
                    <>
                      <div className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-bold text-sm rounded-lg">
                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                        Export complete
                      </div>
                      <button
                        onClick={() => onNavigate?.("dashboard")}
                        className="w-full flex items-center justify-center gap-2 py-2.5 border border-outline rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">home</span>
                        Back to Dashboard
                      </button>
                    </>
                  )}

                  {jiraState !== "connected" && !exportDone && (
                    <p className="text-[11px] text-on-surface-variant/60 text-center">
                      Connect Jira to enable export
                    </p>
                  )}
                  {jiraState === "connected" && !selectedProject && !exportDone && (
                    <p className="text-[11px] text-on-surface-variant/60 text-center">
                      Select a project to enable export
                    </p>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
