import { useState, useRef, useEffect } from "react";
import { analyzeWorkshop } from "../api/workshop";
import {
  createWorkflow, storeCurrentWorkflowId,
  loadCurrentWorkflowId, loadCurrentWorkshopId, storeCurrentWorkshopId,
} from "../api/workflows";
import { createWorkshop, updateWorkshop } from "../api/workshops";
import {
  getMuralConnectUrl,
  getMuralStatus,
  getMuralWorkspaces,
  getMuralsInWorkspace,
  importMural,
} from "../api/mural";

// ─── Local storage helpers ────────────────────────────────────────────────────
const LS_KEY = "mural_oauth_state";
const saveMuralState  = (s) => localStorage.setItem(LS_KEY, s);
const loadMuralState  = ()  => localStorage.getItem(LS_KEY);
const clearMuralState = ()  => localStorage.removeItem(LS_KEY);
const getConnectedLabel = (user) => user?.full_name || user?.username || "Mural workspace";

// ─── Other visual tools (static — not wired yet) ─────────────────────────────
const OTHER_TOOLS = [
  { id: "miro",   label: "Miro",   icon: "dashboard_customize", color: "text-yellow-500", bg: "bg-yellow-50"  },
  { id: "figjam", label: "FigJam", icon: "hub",                 color: "text-purple-500", bg: "bg-purple-50"  },
  { id: "notion", label: "Notion", icon: "auto_stories",        color: "text-slate-700",  bg: "bg-slate-100"  },
];

// ─── Mural connector component ────────────────────────────────────────────────
function MuralConnector({ onInsightsImported }) {
  // connection state machine: idle | connecting | loading_workspaces | selecting | importing | imported
  const [phase, setPhase]               = useState(() => loadMuralState() ? "loading_workspaces" : "idle");
  const [oauthState, setOauthState]     = useState(loadMuralState);
  const [connectedUser, setConnectedUser] = useState(null);
  const [workspaces, setWorkspaces]     = useState([]);
  const [murals, setMurals]             = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState("");
  const [selectedMural, setSelectedMural]         = useState("");
  const [error, setError]               = useState(null);
  useEffect(() => {
    if (oauthState) {
      checkStatus(oauthState);
    }
  }, []);

  async function checkStatus(state) {
    try {
      const res = await getMuralStatus(state);
      if (res.connected) {
        setConnectedUser(res);
        setPhase("loading_workspaces");
        fetchWorkspaces(state);
      } else {
        setPhase("idle");
      }
    } catch (e) {
      setError("Could not confirm Mural connection: " + e.message);
      setPhase("idle");
    }
  }

  async function fetchWorkspaces(state) {
    try {
      const res = await getMuralWorkspaces(state);
      setWorkspaces(res.workspaces ?? []);
      setPhase("selecting");
    } catch (e) {
      setError("Could not load workspaces: " + e.message);
      setPhase("connected");
    }
  }

  async function handleConnect() {
    setError(null);
    setPhase("connecting");
    try {
      const { authorization_url, state } = await getMuralConnectUrl();
      setOauthState(state);
      saveMuralState(state);
      localStorage.setItem("oauth_mural_origin", "workshop");
      window.location.assign(authorization_url);
    } catch (e) {
      setError(e.message);
      setPhase("idle");
    }
  }

  async function handleWorkspaceChange(wsId) {
    setSelectedWorkspace(wsId);
    setSelectedMural("");
    setMurals([]);
    if (!wsId) return;
    try {
      const res = await getMuralsInWorkspace(wsId, oauthState);
      setMurals(res.murals ?? []);
    } catch (e) {
      setError("Could not load murals: " + e.message);
    }
  }

  async function handleImport() {
    if (!selectedMural) return;
    setError(null);
    setPhase("importing");
    try {
      const res = await importMural(selectedMural, oauthState);
      setPhase("imported");
      onInsightsImported({
        source: "mural",
        muralName: res.mural_name,
        widgetCount: res.imported_widget_count,
        insights: res.insights,
        journey: res.journey,
      });
    } catch (e) {
      setError("Import failed: " + e.message);
      setPhase("selecting");
    }
  }

  function handleDisconnect() {
    clearMuralState();
    setOauthState(null);
    setConnectedUser(null);
    setWorkspaces([]);
    setMurals([]);
    setSelectedWorkspace("");
    setSelectedMural("");
    setPhase("idle");
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="border border-outline rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-4 p-4 bg-surface">
        <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px] text-orange-500">brush</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-on-surface">Mural</p>
            <p className="text-[11px] text-on-surface-variant">
              {phase === "idle"        && "Connect to import board content"}
              {phase === "connecting"  && "Starting OAuth..."}
              {(phase === "loading_workspaces") && "Loading workspaces..."}
              {(phase === "selecting" || phase === "importing" || phase === "imported") &&
              connectedUser && `Connected as ${getConnectedLabel(connectedUser)}`}
            </p>
        </div>

        {/* Status / action button */}
        {phase === "idle" && (
          <button
            onClick={handleConnect}
            className="shrink-0 text-[11px] font-bold px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dim transition-all"
          >
            Connect
          </button>
        )}
        {(phase === "connecting" || phase === "loading_workspaces") && (
          <div className="shrink-0 flex items-center gap-2 text-[11px] text-on-surface-variant">
            <span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            {phase === "connecting" ? "Redirecting..." : "Connecting..."}
          </div>
        )}
        {(phase === "selecting" || phase === "importing" || phase === "imported") && (
          <div className="shrink-0 flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Connected
            </span>
            <button
              onClick={handleDisconnect}
              className="text-[11px] text-on-surface-variant hover:text-error transition-colors"
              title="Disconnect"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
            </button>
          </div>
        )}
      </div>

      {/* Workspace + mural selectors */}
      {phase === "selecting" && (
        <div className="px-4 pb-4 pt-3 bg-surface border-t border-outline space-y-3">
          {/* Workspace selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
              Workspace
            </label>
            <select
              value={selectedWorkspace}
              onChange={(e) => handleWorkspaceChange(e.target.value)}
              className="w-full bg-surface-container border border-outline text-sm text-on-surface rounded-lg px-3 py-2 outline-none focus:border-primary transition-all"
            >
              <option value="">Select a workspace...</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} {ws.member_count ? `(${ws.member_count} members)` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Mural selector */}
          {murals.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                Board
              </label>
              <select
                value={selectedMural}
                onChange={(e) => setSelectedMural(e.target.value)}
                className="w-full bg-surface-container border border-outline text-sm text-on-surface rounded-lg px-3 py-2 outline-none focus:border-primary transition-all"
              >
                <option value="">Select a board...</option>
                {murals.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Import button */}
          {selectedMural && (
            <button
              onClick={handleImport}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary-dim transition-all active:scale-[0.99]"
            >
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                download
              </span>
              Import to Workshop
            </button>
          )}
        </div>
      )}

      {/* Importing state */}
      {phase === "importing" && (
        <div className="px-4 pb-4 pt-3 bg-surface border-t border-outline">
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
            <p className="text-[12px] text-primary font-medium">Importing board content and extracting insights...</p>
          </div>
        </div>
      )}

      {/* Imported success */}
      {phase === "imported" && (
        <div className="px-4 pb-4 pt-3 bg-surface border-t border-outline">
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
            <span className="material-symbols-outlined text-[16px] text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
            <p className="text-[12px] text-green-700 font-medium">Board imported — insights loaded into extraction panel</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 pb-4 pt-0 bg-surface border-t border-outline">
          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
            <span className="material-symbols-outlined text-[14px] text-error mt-0.5">error</span>
            <p className="text-[11px] text-red-600">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Priority badge ───────────────────────────────────────────────────────────
function PriorityBadge({ priority }) {
  const map = {
    high:   "bg-red-50 text-red-600 border border-red-100",
    medium: "bg-amber-50 text-amber-600 border border-amber-100",
    low:    "bg-slate-50 text-slate-500 border border-slate-200",
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${map[priority] ?? map.low}`}>
      {priority ?? "Medium"}
    </span>
  );
}

// ─── Extraction section ───────────────────────────────────────────────────────
function ExtractionSection({ icon, label, items, iconColor }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={`material-symbols-outlined text-[16px] ${iconColor}`}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
        <span className="ml-auto text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
            <p className="text-[12px] text-slate-300 leading-relaxed">{item}</p>
            {label === "Action Items" && (
              <div className="mt-2">
                <PriorityBadge priority="high" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WorkshopIntelligence({ onNavigate, project }) {
  const [title, setTitle]           = useState("");
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading]       = useState(false);
  const [insights, setInsights]     = useState(null);
  const [journey, setJourney]       = useState(null);
  const [importMeta, setImportMeta] = useState(null);
  const [error, setError]           = useState(null);
  const [dragOver, setDragOver]     = useState(false);
  const [saveStatus, setSaveStatus]   = useState(null); // null | "saving" | "saved" | "error"
  const [proceeding, setProceeding]   = useState(false);
  const fileRef    = useRef(null);
  const saveTimer  = useRef(null);
  const lastSave   = useRef(null); // { workshopId, data } — retained for retry

  async function persistWorkshop(workshopId, data) {
    if (!workshopId) return;
    clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    lastSave.current = { workshopId, data };
    try {
      await updateWorkshop(workshopId, data);
      setSaveStatus("saved");
      saveTimer.current = setTimeout(() => setSaveStatus(null), 2500);
    } catch {
      setSaveStatus("error");
    }
  }

  function retryLastSave() {
    if (lastSave.current) persistWorkshop(lastSave.current.workshopId, lastSave.current.data);
  }

  // Hydrate only when explicitly resumed from WorkflowList.
  // restoreWorkflowState() only sets a one-shot restore flag when the resumed step is
  // actually "workshop". That prevents old extraction data from appearing on a fresh
  // workshop visit after resuming some later step like Stories or Jira.
  useEffect(() => {
    const flag = sessionStorage.getItem("workflow_restore_pending");
    const step = sessionStorage.getItem("workflow_restore_step");
    if (flag !== "true" || step !== "workshop") return;
    sessionStorage.removeItem("workflow_restore_pending");
    sessionStorage.removeItem("workflow_restore_step");
    const raw = sessionStorage.getItem("workshop_pipeline_data");
    if (!raw) return;
    try {
      const { title: t, insights: i, journey: j } = JSON.parse(raw);
      if (t) setTitle(t);
      if (i) setInsights(i);
      if (j) setJourney(j);
      if (j?.stages?.length) setImportMeta({ source: "mural" });
    } catch { /* ignore malformed data */ }
  }, []);

  const totalInsights = insights
    ? Object.values(insights).reduce((sum, arr) => sum + (arr?.length ?? 0), 0)
    : 0;
  const isJourneyImport = importMeta?.source === "mural" && Boolean(journey?.stages?.length);
  const primarySectionLabel = isJourneyImport ? "Interactions" : "Action Items";
  const primarySectionIcon = isJourneyImport ? "touch_app" : "task_alt";

  // Called by MuralConnector after a successful board import
  function handleMuralImport({ source, muralName, widgetCount, insights: muralInsights, journey: muralJourney }) {
    setImportMeta({ source, muralName, widgetCount });
    setInsights(muralInsights);
    if (muralJourney) setJourney(muralJourney);
    persistWorkshop(loadCurrentWorkshopId(), {
      import_meta:      { source, mural_name: muralName, widget_count: widgetCount },
      insights_payload: muralInsights,
      ...(muralJourney ? { journey_payload: muralJourney } : {}),
    });
  }

  async function handleNextStep() {
    setProceeding(true);
    sessionStorage.setItem("workshop_pipeline_data", JSON.stringify({ title, insights, journey }));
    // Only create new records when we don't already have a workflow run (i.e. not a resume)
    if (!loadCurrentWorkflowId()) {
      try {
        // Create workshop record first if we have project context and no existing workshop
        let workshopId = loadCurrentWorkshopId();
        if (project?.id && !workshopId) {
          const ws = await createWorkshop({
            title: title || "Untitled Workshop",
            project_id: project.id,
          });
          workshopId = ws.id;
          storeCurrentWorkshopId(ws.id);
        }
        // Persist final title — awaited so the record is correct before the run is created
        if (workshopId) {
          await persistWorkshop(workshopId, { title: title || "Untitled Workshop" });
        }
        // Then create the workflow run, linked to both project and workshop
        const wf = await createWorkflow({
          title: title || "Untitled Workshop",
          workflow_type: "workshop",
          workflow_definition_key: "discovery_to_delivery",
          workflow_definition_label: "Discovery to Delivery",
          ...(project?.id    ? { project_id:  project.id } : {}),
          ...(workshopId     ? { workshop_id: workshopId } : {}),
        });
        storeCurrentWorkflowId(wf.id);
      } catch (e) {
        console.warn("[workflow] create failed:", e);
      }
    }
    onNavigate?.("opportunity");
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0] ?? e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setTranscript(ev.target.result);
    reader.readAsText(file);
  }

  async function handleAnalyze() {
    if (!transcript.trim()) return;
    setLoading(true);
    setError(null);
    setInsights(null);
    setImportMeta(null);
    try {
      const result = await analyzeWorkshop({ title: title || "Untitled Workshop", transcript, notes: null });
      setInsights(result.insights);
      persistWorkshop(loadCurrentWorkshopId(), {
        transcript,
        insights_payload: result.insights,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-10 py-10">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mb-10">
        <div className="flex-1 mr-6">
          <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface mb-3">
            Workshop <span className="text-primary">Intelligence</span>
          </h2>
          <div className="flex items-center gap-2 mb-3 group/name">
            <span className="material-symbols-outlined text-[15px] text-on-surface-variant shrink-0">edit_note</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name your workshop…"
              className="flex-1 text-sm font-semibold text-on-surface bg-transparent border-b border-transparent hover:border-outline focus:border-primary outline-none placeholder-on-surface-variant/40 transition-colors pb-0.5"
            />
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-[11px] text-on-surface-variant shrink-0">
                <span className="w-3 h-3 border-2 border-on-surface-variant/30 border-t-on-surface-variant rounded-full animate-spin" />
                Saving…
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-[11px] text-green-600 shrink-0">
                <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                Saved
              </span>
            )}
            {saveStatus === "error" && (
              <button
                onClick={retryLastSave}
                className="flex items-center gap-1 text-[11px] text-error hover:text-red-700 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[13px]">error</span>
                Save failed — retry
              </button>
            )}
          </div>
          <p className="text-on-surface-variant text-sm max-w-xl leading-relaxed">
            Synthesizing human collaboration into actionable product architecture through autonomous cognitive extraction.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full shrink-0">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Story Agent Active</span>
        </div>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-8">

        {/* ── LEFT: Input panel ────────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-7 space-y-6">

          {/* ── Visual Tools ─────────────────────────────────────────── */}
          <div className="bg-surface border border-outline rounded-xl p-6 shadow-card">
            <div className="mb-5">
              <h3 className="text-primary font-headline text-xs font-bold tracking-widest uppercase">
                Visual Tool Connections
              </h3>
              <p className="text-[11px] text-on-surface-variant mt-1">
                Connect to extract notes, stickies, and diagrams directly
              </p>
            </div>

            {/* Mural — fully wired */}
            <div className="mb-4">
              <MuralConnector onInsightsImported={handleMuralImport} />
            </div>

            {/* Other tools — coming soon */}
            <div className="grid grid-cols-3 gap-3">
              {OTHER_TOOLS.map(({ id, label, icon, color, bg }) => (
                <button
                  key={id}
                  disabled
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-outline bg-surface-container opacity-60 cursor-not-allowed"
                >
                  <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                    <span className={`material-symbols-outlined text-[20px] ${color}`}>{icon}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-on-surface-variant">{label}</span>
                  <span className="text-[10px] text-on-surface-variant bg-surface px-2 py-0.5 rounded-full border border-outline">
                    Coming soon
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 p-3 bg-surface-container rounded-lg border border-outline flex items-center gap-3">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">info</span>
              <p className="text-[11px] text-on-surface-variant">
                Connect your visual collaboration tools to auto-extract sticky notes, action items, and board content.
                Miro, FigJam, and Notion integrations coming next.
              </p>
            </div>
          </div>

          {/* ── Transcript Upload ─────────────────────────────────────── */}
          <div className="bg-surface border border-outline rounded-xl p-6 shadow-card">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-primary font-headline text-xs font-bold tracking-widest uppercase">
                  Workshop Input
                </h3>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  Supports .txt, .pdf, .md and raw transcripts
                </p>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 border border-outline rounded-lg text-[11px] font-semibold text-on-surface-variant hover:bg-surface-container hover:border-primary transition-all"
              >
                <span className="material-symbols-outlined text-[14px]">upload_file</span>
                Upload File
              </button>
              <input ref={fileRef} type="file" accept=".txt,.md,.pdf" className="hidden" onChange={handleDrop} />
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative rounded-lg border-2 border-dashed transition-all mb-4 ${
                dragOver ? "border-primary bg-blue-50/50" : "border-outline bg-surface-container"
              }`}
            >
              {!transcript ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <span className="material-symbols-outlined text-[36px] text-on-surface-variant">upload_file</span>
                  <p className="text-sm font-medium text-on-surface-variant">Drop transcripts or paste notes here</p>
                  <p className="text-[11px] text-on-surface-variant">AI will automatically segment and classify content</p>
                </div>
              ) : (
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={10}
                  className="w-full bg-transparent p-4 text-sm text-on-surface resize-none outline-none leading-relaxed"
                  placeholder="Paste workshop transcript here..."
                />
              )}
            </div>

            {transcript && (
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] text-on-surface-variant">
                  {transcript.length.toLocaleString()} characters · {transcript.split(/\s+/).filter(Boolean).length.toLocaleString()} words
                </span>
                <button
                  onClick={() => setTranscript("")}
                  className="text-[11px] text-on-surface-variant hover:text-error transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                  Clear
                </button>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-error mt-0.5">error</span>
                <p className="text-[12px] text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!transcript.trim() || loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary-dim transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Extracting Intelligence...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                  Analyze Workshop
                </>
              )}
            </button>
          </div>

        </div>

        {/* ── RIGHT: Live Extraction panel ─────────────────────────────── */}
        <div className="col-span-12 lg:col-span-5">
          <div className="bg-sidebar rounded-xl overflow-hidden sticky top-[76px]">

            {/* Panel header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-white font-headline text-xs font-bold tracking-widest uppercase">
                  Live Extraction
                </h3>
                {loading && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                {insights && !loading && (
                  <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Complete
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {loading
                  ? "Autonomous intelligence is processing the input stream..."
                  : insights && importMeta
                  ? `Extracted from Mural: ${importMeta.muralName} · ${importMeta.widgetCount} widgets processed`
                  : insights
                  ? "Extraction complete — review and proceed to initiatives"
                  : "Awaiting workshop input to begin extraction"}
              </p>
            </div>

            {/* Extraction results */}
            <div className="px-6 py-5 max-h-[calc(100vh-280px)] overflow-y-auto">
              {!insights && !loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px] text-slate-500">psychology</span>
                  </div>
                  <p className="text-[12px] text-slate-500 text-center leading-relaxed">
                    Connect a visual tool or paste your<br />workshop transcript and analyze
                  </p>
                </div>
              )}

              {loading && (
                <div className="space-y-4 py-4">
                  {["Action Items", "Decisions", "Pain Points", "Opportunities"].map((label) => (
                    <div key={label}>
                      <div className="h-2.5 bg-slate-800 rounded w-24 mb-3 animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-12 bg-slate-800 rounded-lg animate-pulse" />
                        <div className="h-12 bg-slate-800 rounded-lg animate-pulse opacity-70" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {insights && !loading && (
                <div>
                  <ExtractionSection icon={primarySectionIcon} label={primarySectionLabel} items={insights.action_items} iconColor="text-blue-400" />
                  <ExtractionSection icon="gavel"     label="Decisions"     items={insights.decisions}     iconColor="text-green-400"  />
                  <ExtractionSection icon="warning"   label="Pain Points"   items={insights.pain_points}   iconColor="text-amber-400"  />
                  <ExtractionSection icon="lightbulb" label="Opportunities" items={insights.opportunities} iconColor="text-purple-400" />
                </div>
              )}
            </div>

            {/* Stats footer */}
            {insights && !loading && (
              <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
                <div className="text-center">
                  <p className="text-2xl font-headline font-bold text-white">{totalInsights}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Insights</p>
                </div>
                <div className="w-px h-10 bg-slate-800" />
                <div className="text-center">
                  <p className="text-sm font-headline font-bold text-primary">Heuristic</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Extraction Mode</p>
                </div>
                <div className="w-px h-10 bg-slate-800" />
                <button
                  onClick={handleNextStep}
                  disabled={proceeding}
                  className="flex flex-col items-center gap-1 text-primary hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {proceeding
                    ? <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    : <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  }
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {proceeding ? "Saving…" : "Validate"}
                  </span>
                </button>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
