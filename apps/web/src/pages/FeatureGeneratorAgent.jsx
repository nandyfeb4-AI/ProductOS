import { useState, useRef, useEffect } from "react";
import { openJobSocket } from "../api/jobs";
import { startFeatureGeneratorJob } from "../api/agents";
import { getSkills } from "../api/skills";
import { getProjectFeature } from "../api/projectFeatures";
import {
  exportFeatureToJira,
  getJiraAuthorization,
  getJiraProjects,
  getJiraStatus,
  readJiraConnectionCache,
  writeJiraConnectionCache,
} from "../api/jira";

// ─── Config ───────────────────────────────────────────────────────────────────
const SOURCE_TYPES = [
  { value: "prompt",       label: "Problem Statement"    },
  { value: "opportunity",  label: "Opportunity / Finding" },
  { value: "requirement",  label: "Requirement Context"  },
];

const PRIORITY_CONFIG = {
  high:   { label: "High",   badge: "bg-red-50 text-red-600 border-red-100"        },
  medium: { label: "Medium", badge: "bg-amber-50 text-amber-600 border-amber-100"  },
  low:    { label: "Low",    badge: "bg-slate-100 text-slate-500 border-slate-200" },
};

const FEATURE_RESULT_CACHE_KEY   = "feature_generator_result_v1";
const FEATURE_RESULT_RESTORE_KEY = "feature_generator_restore_pending";
const FEATURE_OPEN_ID_KEY        = "feature_generator_open_id";

// ─── Tag input ────────────────────────────────────────────────────────────────
function TagInput({ label, hint, tags, onAdd, onRemove }) {
  const [input, setInput] = useState("");

  function handleKeyDown(e) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      onAdd(input.trim());
      setInput("");
    }
  }

  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
        {label} <span className="normal-case font-normal tracking-normal">(optional)</span>
      </label>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-[11px] font-semibold rounded-full border border-primary/20"
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="hover:text-red-500 transition-colors ml-0.5"
              >
                <span className="material-symbols-outlined text-[12px]">close</span>
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={hint}
        className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 transition"
      />
      <p className="text-[10px] text-on-surface-variant mt-1">Press Enter to add</p>
    </div>
  );
}

// ─── Result section card ──────────────────────────────────────────────────────
function ResultSection({ icon, title, accent = "blue", children }) {
  const ACCENTS = {
    blue:   { icon: "text-blue-500",   bg: "bg-blue-50",   border: "border-blue-100"   },
    violet: { icon: "text-violet-500", bg: "bg-violet-50", border: "border-violet-100" },
    green:  { icon: "text-green-600",  bg: "bg-green-50",  border: "border-green-100"  },
    amber:  { icon: "text-amber-500",  bg: "bg-amber-50",  border: "border-amber-100"  },
    rose:   { icon: "text-rose-500",   bg: "bg-rose-50",   border: "border-rose-100"   },
    slate:  { icon: "text-slate-500",  bg: "bg-slate-100", border: "border-slate-200"  },
  };
  const a = ACCENTS[accent] ?? ACCENTS.blue;
  return (
    <div className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-sm">
      <div className={`flex items-center gap-2.5 px-5 py-3 ${a.bg} border-b ${a.border}`}>
        <span className={`material-symbols-outlined text-[15px] ${a.icon}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{title}</h4>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FeatureGeneratorAgent({ project, onNavigate }) {
  // phase: "form" | "running" | "result"
  const [phase, setPhase]                   = useState("form");
  const [sourceType, setSourceType]         = useState("prompt");
  const [sourceTitle, setSourceTitle]       = useState("");
  const [sourceSummary, setSourceSummary]   = useState("");
  const [sourceDetails, setSourceDetails]   = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [constraints, setConstraints]       = useState([]);
  const [supportingCtx, setSupportingCtx]   = useState([]);
  const [jobMessage, setJobMessage]         = useState(null);
  const [feature, setFeature]               = useState(null);
  const [error, setError]                   = useState(null);
  const [featureSkill, setFeatureSkill]     = useState(null);
  const [jiraState, setJiraState]           = useState("idle");
  const [jiraInfo, setJiraInfo]             = useState(null);
  const [jiraProjects, setJiraProjects]     = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [jiraError, setJiraError]           = useState(null);
  const [jiraResult, setJiraResult]         = useState(null);
  const [pushingToJira, setPushingToJira]   = useState(false);
  const wsRef = useRef(null);

  useEffect(() => () => wsRef.current?.close(), []);

  useEffect(() => {
    try {
      const shouldRestore = sessionStorage.getItem(FEATURE_RESULT_RESTORE_KEY) === "true";
      if (!shouldRestore) return;
      const cached = JSON.parse(sessionStorage.getItem(FEATURE_RESULT_CACHE_KEY) ?? "null");
      if (cached?.feature) {
        setFeature(cached.feature);
        setPhase("result");
        setJiraResult(cached.jiraResult ?? null);
      }
    } catch {
      // Ignore restore failures.
    } finally {
      try {
        sessionStorage.removeItem(FEATURE_RESULT_RESTORE_KEY);
      } catch {
        // Ignore cleanup failures.
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSkills("feature_spec", true)
      .then((result) => {
        if (cancelled) return;
        const rows = Array.isArray(result) ? result : (result.skills ?? []);
        setFeatureSkill(rows[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setFeatureSkill(null);
      });
    return () => { cancelled = true; };
  }, []);

  // Load a persisted feature by ID when navigated from the Features tab.
  // Must NOT go through applyResult — that always writes jiraResult: null.
  // Instead, restore Jira sync state directly from the persisted feature fields.
  useEffect(() => {
    let cancelled = false;
    let openId;
    try { openId = sessionStorage.getItem(FEATURE_OPEN_ID_KEY); } catch {}
    if (!openId) return;
    try { sessionStorage.removeItem(FEATURE_OPEN_ID_KEY); } catch {}
    setPhase("running");
    setJobMessage("Loading feature…");
    getProjectFeature(openId)
      .then((f) => {
        if (cancelled) return;
        const nextFeature  = f?.feature ?? f;
        const restoredJira = (nextFeature.status === "exported" && nextFeature.jira_issue_key)
          ? { issue_key: nextFeature.jira_issue_key, issue_url: nextFeature.jira_issue_url, issue_type: nextFeature.jira_issue_type }
          : null;
        setFeature(nextFeature);
        setJiraResult(restoredJira);
        try {
          sessionStorage.setItem(FEATURE_RESULT_CACHE_KEY, JSON.stringify({ feature: nextFeature, jiraResult: restoredJira }));
        } catch {}
        setPhase("result");
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load this feature. Please try again.");
          setPhase("form");
        }
      });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "result" || !feature) return;

    const cached = readJiraConnectionCache();
    if (cached?.connected) {
      setJiraState("connected");
      setJiraInfo(cached.jiraInfo ?? null);
      setJiraProjects(Array.isArray(cached.projects) ? cached.projects : []);
      if (cached.selectedProject) setSelectedProject(cached.selectedProject);
    } else {
      setJiraState("checking");
    }

    const callbackDone = localStorage.getItem("jira_oauth_connected") === "true";
    if (callbackDone || !cached?.connected || !(cached?.projects?.length > 0)) {
      setJiraState("checking");
      getJiraStatus()
        .then((result) => {
          if (!result.connected) {
            setJiraState("disconnected");
            return null;
          }
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
        })
        .then((projectResult) => {
          if (!projectResult) return;
          const rows = projectResult.projects ?? [];
          const nextSelected = rows.length === 1
            ? rows[0].key
            : (cached?.selectedProject && rows.some((p) => p.key === cached.selectedProject) ? cached.selectedProject : "");
          setJiraProjects(rows);
          if (nextSelected) setSelectedProject(nextSelected);
          setJiraState("connected");
          writeJiraConnectionCache({
            connected: true,
            jiraInfo: cached?.jiraInfo ?? jiraInfo,
            projects: rows,
            selectedProject: nextSelected,
          });
        })
        .catch((err) => {
          setJiraError(err.message);
          setJiraState("disconnected");
        })
        .finally(() => {
          if (callbackDone) localStorage.removeItem("jira_oauth_connected");
        });
    }
  }, [phase, feature]); // eslint-disable-line react-hooks/exhaustive-deps

  function connectSocket(id) {
    wsRef.current?.close();
    const ws = openJobSocket(id);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      let parsed;
      try { parsed = JSON.parse(e.data); } catch { return; }
      if (parsed.event !== "job.updated") return;
      const job = parsed.job;
      setJobMessage(job.progress_message ?? null);
      if (job.status === "completed") {
        applyResult(job.result_payload);
        ws.close();
      } else if (job.status === "failed" || job.status === "cancelled") {
        setError(job.error_message ?? "Feature generation failed. Please retry.");
        setPhase("form");
        ws.close();
      }
    };

    ws.onerror = () => {
      setError("Connection lost. Please retry.");
      setPhase("form");
    };
  }

  function applyResult(payload) {
    const nextFeature = payload?.feature ?? payload;
    setFeature(nextFeature);
    try {
      sessionStorage.setItem(FEATURE_RESULT_CACHE_KEY, JSON.stringify({ feature: nextFeature, jiraResult: null }));
    } catch {
      // Ignore cache write failures.
    }
    setPhase("result");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!sourceTitle.trim() || !sourceSummary.trim()) return;
    setError(null);
    setPhase("running");
    setJobMessage("Initialising feature generation...");
    try {
      const body = {
        source_type:    sourceType,
        source_title:   sourceTitle.trim(),
        source_summary: sourceSummary.trim(),
        ...(sourceDetails.trim()  ? { source_details:     sourceDetails.trim()  } : {}),
        ...(desiredOutcome.trim() ? { desired_outcome:    desiredOutcome.trim() } : {}),
        ...(constraints.length    ? { constraints }                               : {}),
        ...(supportingCtx.length  ? { supporting_context: supportingCtx }         : {}),
        ...(project?.id           ? { project_id: project.id }                    : {}),
      };
      const result = await startFeatureGeneratorJob(body);
      const id = result.job?.id;
      if (!id) throw new Error("No job ID returned from server.");
      setJobMessage(result.job.progress_message ?? "Generating feature draft...");
      connectSocket(id);
    } catch (err) {
      setError(err.message);
      setPhase("form");
    }
  }

  function handleReset() {
    wsRef.current?.close();
    setPhase("form");
    setFeature(null);
    setError(null);
    setJobMessage(null);
    setJiraError(null);
    setJiraResult(null);
    setSelectedProject("");
    try {
      sessionStorage.removeItem(FEATURE_RESULT_CACHE_KEY);
      sessionStorage.removeItem(FEATURE_RESULT_RESTORE_KEY);
      sessionStorage.removeItem(FEATURE_OPEN_ID_KEY);
    } catch {
      // Ignore cache clear failures.
    }
  }

  async function handleConnectJira() {
    setJiraError(null);
    setJiraState("connecting");
    try {
      localStorage.setItem("oauth_jira_origin", "feature-generator");
      sessionStorage.setItem(FEATURE_RESULT_RESTORE_KEY, "true");
      const result = await getJiraAuthorization();
      window.location.href = result.authorization_url;
    } catch (err) {
      setJiraError(err.message);
      setJiraState("disconnected");
    }
  }

  async function handlePushFeatureToJira() {
    if (!feature || !selectedProject) return;
    setPushingToJira(true);
    setJiraError(null);
    try {
      const result = await exportFeatureToJira({
        project_key: selectedProject,
        feature,
      });
      setJiraResult(result);
      writeJiraConnectionCache({
        connected: true,
        jiraInfo,
        projects: jiraProjects,
        selectedProject,
      });
      try {
        sessionStorage.setItem(FEATURE_RESULT_CACHE_KEY, JSON.stringify({ feature, jiraResult: result }));
      } catch {
        // Ignore cache write failures.
      }
    } catch (err) {
      setJiraError(err.message);
    } finally {
      setPushingToJira(false);
    }
  }

  // ── Shared page header ────────────────────────────────────────────────────
  function PageHeader({ subtitle }) {
    return (
      <div className="mb-8">
        <button
          onClick={() => onNavigate?.("project-detail", project)}
          className="flex items-center gap-1 text-[12px] font-semibold text-on-surface-variant hover:text-primary transition-colors mb-6"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          Back to Project
        </button>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 border-2 border-violet-100 flex items-center justify-center shrink-0 shadow-sm">
            <span
              className="material-symbols-outlined text-[22px] text-violet-500"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              Feature Generator
            </p>
            <h2 className="text-2xl font-headline font-bold text-on-surface">{subtitle}</h2>
          </div>
        </div>
      </div>
    );
  }

  // ── Result view ───────────────────────────────────────────────────────────
  if (phase === "result" && feature) {
    const body   = feature.body ?? {};
    const priCfg = PRIORITY_CONFIG[body.priority] ?? PRIORITY_CONFIG.medium;

    return (
      <div className="px-10 py-10">
        {/* Back nav */}
        <button
          onClick={() => onNavigate?.("project-detail", project)}
          className="flex items-center gap-1 text-[12px] font-semibold text-on-surface-variant hover:text-primary transition-colors mb-6"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          Back to Project
        </button>

        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">

          {/* ── Left panel — sticky meta ─────────────────────────────── */}
          <div className="xl:sticky xl:top-8 space-y-4">

            {/* Hero card */}
            <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl p-6 shadow-lg shadow-violet-500/20">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="material-symbols-outlined text-[18px] text-violet-200"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  auto_awesome
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-200">
                  Feature Generator
                </span>
              </div>
              <h2 className="text-xl font-headline font-bold text-white leading-snug mb-3">
                {feature.title || "Generated Feature"}
              </h2>
              {feature.summary && (
                <p className="text-[13px] text-violet-100/80 leading-relaxed">{feature.summary}</p>
              )}
            </div>

            {/* Meta card */}
            <div className="bg-surface border border-outline rounded-2xl p-5 shadow-card space-y-4">
              {/* Priority */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant">flag</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Priority</span>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${priCfg.badge}`}>
                  {priCfg.label}
                </span>
              </div>

              {/* User segment */}
              {body.user_segment && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">group</span>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">User Segment</span>
                  </div>
                  <p className="text-sm text-on-surface leading-relaxed">{body.user_segment}</p>
                </div>
              )}

              {/* Project */}
              {project && (
                <>
                  <div className="border-t border-outline/60" />
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">inventory_2</span>
                    <span className="text-[11px] text-on-surface-variant">From</span>
                    <span className="text-[11px] font-bold text-on-surface">{project.name}</span>
                  </div>
                </>
              )}

              {/* Skill */}
              {featureSkill && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-violet-500">psychology</span>
                  <span className="text-[11px] text-on-surface-variant">Skill</span>
                  <span className="text-[11px] font-bold text-on-surface truncate">{featureSkill.name}</span>
                </div>
              )}
            </div>

            {/* Run again */}
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface border border-outline text-on-surface text-sm font-bold rounded-xl hover:border-primary hover:text-primary transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Run Again
            </button>

            {/* Jira export card */}
            <div className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-card">
              {/* Header strip */}
              <div className="flex items-center gap-3 px-5 py-3.5 bg-[#0052CC]/5 border-b border-[#0052CC]/10">
                <div className="w-7 h-7 rounded-md bg-[#0052CC] flex items-center justify-center shrink-0">
                  {/* Jira-style "J" mark */}
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.004-1.005zm5.723-5.756H5.757a5.215 5.215 0 0 0 5.214 5.214h2.132v2.058a5.218 5.218 0 0 0 5.215 5.214V6.762a1.005 1.005 0 0 0-1.024-1.005zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.132v2.057A5.215 5.215 0 0 0 24.018 12.49V1.005A1.005 1.005 0 0 0 23.013 0z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#0052CC]">Export to Jira</p>
                  <p className="text-[10px] text-on-surface-variant">Push as a feature issue</p>
                </div>
              </div>

              <div className="p-5 space-y-4">

                {/* Error */}
                {jiraError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <span className="material-symbols-outlined text-[14px] text-red-500 mt-0.5 shrink-0">error</span>
                    <p className="text-[12px] text-red-700 leading-snug">{jiraError}</p>
                  </div>
                )}

                {/* Pushed successfully */}
                {jiraResult ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl">
                      <span className="material-symbols-outlined text-[16px] text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <p className="text-[12px] font-semibold text-green-800">Pushed successfully</p>
                    </div>
                    <a
                      href={jiraResult.issue_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-2 px-4 py-3 bg-[#0052CC]/5 border border-[#0052CC]/20 rounded-xl hover:bg-[#0052CC]/10 transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-bold text-[#0052CC] shrink-0">{jiraResult.issue_key}</span>
                        <span className="text-[10px] text-on-surface-variant truncate">· {jiraResult.issue_type}</span>
                      </div>
                      <span className="material-symbols-outlined text-[14px] text-[#0052CC] group-hover:translate-x-0.5 transition-transform shrink-0">open_in_new</span>
                    </a>
                  </div>

                /* Connected — show project picker + push button */
                ) : jiraState === "connected" || jiraState === "loading_projects" ? (
                  <div className="space-y-3">
                    {/* Connection indicator */}
                    {jiraInfo?.display_name && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-surface-container rounded-lg border border-outline">
                        <div className="w-6 h-6 rounded-full bg-[#0052CC] flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-white">
                            {jiraInfo.display_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-on-surface truncate">{jiraInfo.display_name}</p>
                          <p className="text-[10px] text-green-600 font-medium">Connected</p>
                        </div>
                      </div>
                    )}

                    {/* Project selector */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                        Target Project
                      </label>
                      {jiraState === "loading_projects" ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-container border border-outline rounded-lg">
                          <span className="w-3.5 h-3.5 border-2 border-outline border-t-[#0052CC] rounded-full animate-spin shrink-0" />
                          <span className="text-sm text-on-surface-variant">Loading projects…</span>
                        </div>
                      ) : (
                        <select
                          value={selectedProject}
                          onChange={(e) => setSelectedProject(e.target.value)}
                          className="w-full px-3 py-2.5 bg-surface-container border border-outline rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20 focus:border-[#0052CC] transition-all appearance-none"
                        >
                          <option value="">Select a project…</option>
                          {jiraProjects.map((p) => (
                            <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Push button */}
                    <button
                      type="button"
                      onClick={handlePushFeatureToJira}
                      disabled={!selectedProject || pushingToJira || jiraState === "loading_projects"}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0052CC] text-white text-sm font-bold rounded-xl hover:bg-[#0047B3] active:scale-[0.98] transition-all shadow-sm shadow-[#0052CC]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {pushingToJira ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Pushing to Jira…
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>publish</span>
                          Push Feature to Jira
                        </>
                      )}
                    </button>
                  </div>

                /* Disconnected / needs auth */
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-container border border-outline rounded-xl">
                      <span className="material-symbols-outlined text-[14px] text-on-surface-variant">link_off</span>
                      <p className="text-[12px] text-on-surface-variant">Jira not connected</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleConnectJira}
                      disabled={jiraState === "connecting" || jiraState === "checking"}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0052CC] text-white text-sm font-bold rounded-xl hover:bg-[#0047B3] transition-all shadow-sm shadow-[#0052CC]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {(jiraState === "connecting" || jiraState === "checking") ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {jiraState === "checking" ? "Checking connection…" : "Connecting…"}
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">link</span>
                          Connect Atlassian
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right panel — sections ───────────────────────────────── */}
          <div className="space-y-4">

            {/* Problem + Solution row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ResultSection icon="report_problem" title="Problem Statement" accent="rose">
                <p className="text-sm text-on-surface leading-relaxed">{body.problem_statement}</p>
              </ResultSection>
              <ResultSection icon="lightbulb" title="Proposed Solution" accent="violet">
                <p className="text-sm text-on-surface leading-relaxed">{body.proposed_solution}</p>
              </ResultSection>
            </div>

            {/* Value row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ResultSection icon="favorite" title="User Value" accent="blue">
                <p className="text-sm text-on-surface leading-relaxed">{body.user_value}</p>
              </ResultSection>
              <ResultSection icon="trending_up" title="Business Value" accent="green">
                <p className="text-sm text-on-surface leading-relaxed">{body.business_value}</p>
              </ResultSection>
            </div>

            {/* Requirements */}
            {(body.functional_requirements?.length > 0 || body.non_functional_requirements?.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {body.functional_requirements?.length > 0 && (
                  <ResultSection icon="checklist" title="Functional Requirements" accent="blue">
                    <ul className="space-y-2.5">
                      {body.functional_requirements.map((r, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-on-surface">
                          <span className="material-symbols-outlined text-[14px] text-blue-500 mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          <span className="leading-relaxed">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </ResultSection>
                )}
                {body.non_functional_requirements?.length > 0 && (
                  <ResultSection icon="tune" title="Non-Functional Requirements" accent="slate">
                    <ul className="space-y-2.5">
                      {body.non_functional_requirements.map((r, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-on-surface">
                          <span className="material-symbols-outlined text-[14px] text-slate-400 mt-0.5 shrink-0">radio_button_unchecked</span>
                          <span className="leading-relaxed">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </ResultSection>
                )}
              </div>
            )}

            {/* Dependencies + Metrics */}
            {(body.dependencies?.length > 0 || body.success_metrics?.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {body.dependencies?.length > 0 && (
                  <ResultSection icon="link" title="Dependencies" accent="amber">
                    <ul className="space-y-2.5">
                      {body.dependencies.map((d, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-on-surface">
                          <span className="material-symbols-outlined text-[14px] text-amber-500 mt-0.5 shrink-0">warning</span>
                          <span className="leading-relaxed">{d}</span>
                        </li>
                      ))}
                    </ul>
                  </ResultSection>
                )}
                {body.success_metrics?.length > 0 && (
                  <ResultSection icon="analytics" title="Success Metrics" accent="green">
                    <ul className="space-y-2.5">
                      {body.success_metrics.map((m, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-on-surface">
                          <span className="material-symbols-outlined text-[14px] text-green-500 mt-0.5 shrink-0">bar_chart</span>
                          <span className="leading-relaxed">{m}</span>
                        </li>
                      ))}
                    </ul>
                  </ResultSection>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    );
  }

  // ── Running view ──────────────────────────────────────────────────────────
  if (phase === "running") {
    return (
      <div className="px-10 py-10 max-w-xl">
        <PageHeader subtitle="Generating..." />
        <div className="bg-surface border border-outline rounded-2xl p-12 shadow-card flex flex-col items-center gap-6">
          {/* Pulsing icon */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-20 h-20 rounded-full bg-violet-100 animate-ping opacity-40" />
            <div className="w-16 h-16 rounded-full bg-violet-50 border-2 border-violet-100 flex items-center justify-center shadow-sm z-10">
              <span
                className="material-symbols-outlined text-[28px] text-violet-500"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-on-surface">
              {jobMessage ?? "Generating feature draft..."}
            </p>
            <p className="text-[12px] text-on-surface-variant mt-1.5">
              This usually takes 15–30 seconds
            </p>
          </div>

          {/* Indeterminate progress bar */}
          <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-violet-300 via-primary to-violet-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ─────────────────────────────────────────────────────────────
  return (
    <div className="px-10 py-10 max-w-2xl">
      <PageHeader subtitle="New Feature" />

      {/* Project context banner */}
      {project && (
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-container border border-outline rounded-xl mb-6">
          <span className="material-symbols-outlined text-[15px] text-on-surface-variant">inventory_2</span>
          <span className="text-[12px] text-on-surface-variant">Running under</span>
          <span className="text-[12px] font-bold text-on-surface">{project.name}</span>
        </div>
      )}

      {featureSkill && (
        <div className="flex items-center gap-2 px-4 py-3 bg-violet-50 border border-violet-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-[15px] text-violet-500">psychology</span>
          <span className="text-[12px] text-violet-700">Using Feature Spec Skill</span>
          <span className="text-[12px] font-bold text-violet-900">{featureSkill.name}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-error text-[16px]">error</span>
          <p className="text-sm text-red-700 flex-1">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Source type */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Source Type
          </label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
          >
            {SOURCE_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Title
          </label>
          <input
            type="text"
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            placeholder="e.g. Frequent riders abandon booking at destination entry"
            required
            className="w-full px-3 py-2 text-sm font-semibold text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 transition"
          />
        </div>

        {/* Summary */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Summary
          </label>
          <textarea
            value={sourceSummary}
            onChange={(e) => setSourceSummary(e.target.value)}
            placeholder="Brief description of the problem or opportunity..."
            rows={3}
            required
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 resize-none transition"
          />
        </div>

        {/* Details (optional) */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Details <span className="normal-case font-normal tracking-normal">(optional)</span>
          </label>
          <textarea
            value={sourceDetails}
            onChange={(e) => setSourceDetails(e.target.value)}
            placeholder="Longer problem statement or copied requirement context..."
            rows={4}
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 resize-none transition"
          />
        </div>

        {/* Desired outcome (optional) */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Desired Outcome <span className="normal-case font-normal tracking-normal">(optional)</span>
          </label>
          <textarea
            value={desiredOutcome}
            onChange={(e) => setDesiredOutcome(e.target.value)}
            placeholder="What should the generated feature accomplish?"
            rows={2}
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 resize-none transition"
          />
        </div>

        <TagInput
          label="Constraints"
          hint='e.g. "Must work offline" — press Enter to add'
          tags={constraints}
          onAdd={(t) => setConstraints(p => [...p, t])}
          onRemove={(i) => setConstraints(p => p.filter((_, idx) => idx !== i))}
        />

        <TagInput
          label="Supporting Context"
          hint='e.g. "From rider research Q1 2026" — press Enter to add'
          tags={supportingCtx}
          onAdd={(t) => setSupportingCtx(p => [...p, t])}
          onRemove={(i) => setSupportingCtx(p => p.filter((_, idx) => idx !== i))}
        />

        <div className="pt-2">
          <button
            type="submit"
            disabled={!sourceTitle.trim() || !sourceSummary.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dim transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            Generate Feature
          </button>
        </div>

      </form>
    </div>
  );
}
