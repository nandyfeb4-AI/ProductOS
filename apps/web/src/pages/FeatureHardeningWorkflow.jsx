import { useState, useEffect, useRef } from "react";
import {
  createWorkflow, updateWorkflow, getWorkflow,
  loadCurrentWorkflowId, storeCurrentWorkflowId,
  getFeatureHardeningSource, publishFeatureHardening,
} from "../api/workflows";
import { startFeatureHardeningJob, getGenerationJob } from "../api/agents";
import { openJobSocket } from "../api/jobs";
import { getJiraStatus, getJiraProjects } from "../api/jira";

// Backend hard-limit on issue_keys and publish results
const MAX_EPICS = 8;

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS = [
  { key: "source", label: "Source", icon: "cloud_download" },
  { key: "review", label: "Review", icon: "rate_review"    },
  { key: "sync",   label: "Sync",   icon: "cloud_upload"   },
];

// overall_score is on a 1..5 scale
function scoreColor(score) {
  if (score >= 4) return "text-green-700 bg-green-50 border-green-200";
  if (score >= 3) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

// ─── Flowbar ──────────────────────────────────────────────────────────────────
function FlowBar({ current }) {
  const currentIdx = STEPS.findIndex(s => s.key === current);
  return (
    <div className="flex items-start mb-8">
      {STEPS.map((step, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        const isLast  = i === STEPS.length - 1;
        return (
          <div key={step.key} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={[
                "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                done   ? "bg-primary border-primary"                       :
                active ? "bg-white border-primary ring-4 ring-primary/15"  :
                         "bg-surface-container border-outline",
              ].join(" ")}>
                {done ? (
                  <span
                    className="material-symbols-outlined text-[14px] text-white"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                ) : (
                  <span className={`material-symbols-outlined text-[14px] ${active ? "text-primary" : "text-on-surface-variant/40"}`}>
                    {step.icon}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? "text-primary" : done ? "text-primary/60" : "text-on-surface-variant/40"}`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={`flex-1 h-[2px] mt-4 mx-2 ${done ? "bg-primary" : "bg-outline"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Epic row ─────────────────────────────────────────────────────────────────
function EpicRow({ epic, selected, onToggle }) {
  const key = epic.issue_key ?? epic.key;
  return (
    <label className={[
      "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
      selected ? "bg-primary/5 border-primary/30" : "bg-surface border-outline hover:border-primary/20",
    ].join(" ")}>
      <input
        type="checkbox"
        className="mt-0.5 accent-primary shrink-0"
        checked={selected}
        onChange={() => onToggle(key)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 font-mono shrink-0">
            {key}
          </span>
          {epic.status_name && (
            <span className="text-[9px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded border border-outline uppercase tracking-wider">
              {epic.status_name}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-on-surface mt-1 leading-snug">
          {epic.title ?? "Untitled Epic"}
        </p>
        {epic.description_text && (
          <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed line-clamp-2">{epic.description_text}</p>
        )}
      </div>
    </label>
  );
}

// Sub-score labels (displayed on the left panel of each result card)
const EVAL_FIELDS = [
  { key: "problem_clarity_score",          label: "Problem"       },
  { key: "solution_clarity_score",         label: "Solution"      },
  { key: "requirement_completeness_score", label: "Requirements"  },
  { key: "dependency_score",               label: "Dependencies"  },
  { key: "success_metrics_score",          label: "Success Metrics" },
  { key: "implementation_readiness_score", label: "Implementation" },
];

// ─── Result card (two-panel: original context + evaluation | refined output) ──
function ResultCard({ result, approved, onToggleApprove }) {
  const [expanded, setExpanded] = useState(false);
  // Backend shape: { issue_key, source_feature, evaluation, refined_feature, refinement_summary }
  const feature    = result.refined_feature ?? {};
  const body       = feature.body ?? {};
  const evaluation = result.evaluation ?? {};
  const score      = evaluation.overall_score ?? null;
  const needsRefinement = evaluation.needs_refinement ?? false;
  const gaps       = evaluation.gaps ?? [];
  const strengths  = evaluation.strengths ?? [];
  const issueKey   = result.issue_key ?? "";
  const src        = result.source_feature ?? {};

  return (
    <div className={[
      "border rounded-2xl overflow-hidden shadow-card transition-all",
      approved ? "border-green-300" : "border-outline",
    ].join(" ")}>

      {/* Top stripe */}
      <div className={`h-[3px] ${approved ? "bg-gradient-to-r from-green-400 to-emerald-300" : "bg-gradient-to-r from-orange-400 to-amber-400"}`} />

      {/* Full-width header row */}
      <div className={[
        "flex items-center justify-between gap-3 px-5 py-3 border-b",
        approved ? "bg-green-50 border-green-100" : "bg-surface-container border-outline",
      ].join(" ")}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-[10px] font-bold text-primary/70 bg-primary/8 px-2 py-0.5 rounded border border-primary/15 font-mono shrink-0">
            {issueKey}
          </span>
          <h4 className="text-sm font-headline font-bold text-on-surface truncate">
            {feature.title || src.title || "Hardened Feature"}
          </h4>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {score != null && (
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${scoreColor(score)}`}>
              {typeof score === "number" ? `${score}/5` : score}
            </span>
          )}
          {needsRefinement && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full">
              Refined
            </span>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-green-600 w-3.5 h-3.5"
              checked={approved}
              onChange={() => onToggleApprove(issueKey)}
            />
            <span className={`text-[11px] font-semibold ${approved ? "text-green-700" : "text-on-surface-variant"}`}>
              {approved ? "Approved" : "Approve"}
            </span>
          </label>
        </div>
      </div>

      {/* ── Two-panel body ── */}
      <div className="grid grid-cols-[5fr_7fr] divide-x divide-outline bg-surface">

        {/* Left: original context + evaluation */}
        <div className="p-5 space-y-4">

          {/* Original epic */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Original Epic</p>
            <p className="text-[13px] font-semibold text-on-surface leading-snug">{src.title || issueKey}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {src.status_name && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container border border-outline px-1.5 py-0.5 rounded">
                  {src.status_name}
                </span>
              )}
              {src.issue_type && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-primary/60 bg-primary/5 border border-primary/10 px-1.5 py-0.5 rounded">
                  {src.issue_type}
                </span>
              )}
            </div>
            {src.description_text && (
              <p className="text-[11px] text-on-surface-variant mt-2 leading-relaxed line-clamp-3">{src.description_text}</p>
            )}
          </div>

          {/* Evaluation sub-scores */}
          {EVAL_FIELDS.some(f => evaluation[f.key] != null) && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Evaluation Scores</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {EVAL_FIELDS.map(({ key, label }) => {
                  const val = evaluation[key];
                  if (val == null) return null;
                  return (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-on-surface-variant truncate">{label}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${scoreColor(val)}`}>
                        {val}/5
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Strengths */}
          {strengths.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-green-600 mb-1.5">Strengths</p>
              <ul className="space-y-1">
                {strengths.slice(0, 4).map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-on-surface-variant">
                    <span className="material-symbols-outlined text-[10px] text-green-500 mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gaps */}
          {gaps.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600 mb-1.5">Gaps Addressed</p>
              <ul className="space-y-1">
                {gaps.slice(0, 4).map((g, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-on-surface-variant">
                    <span className="material-symbols-outlined text-[10px] text-amber-500 mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_upward</span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* Right: refined feature output */}
        <div className="p-5 space-y-4">

          {/* Refinement summary chip */}
          {result.refinement_summary && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50/70 border border-blue-100 rounded-lg">
              <span className="material-symbols-outlined text-[13px] text-blue-500 mt-0.5 shrink-0">auto_fix_high</span>
              <p className="text-[11px] text-blue-800 leading-relaxed">{result.refinement_summary}</p>
            </div>
          )}

          {/* Refined summary */}
          {feature.summary && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Refined Summary</p>
              <p className="text-[12px] text-on-surface-variant leading-relaxed">{feature.summary}</p>
            </div>
          )}

          {/* Body sections (expandable) */}
          {Object.keys(body).length > 0 && (
            <>
              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary-dim"
              >
                <span className="material-symbols-outlined text-[13px]">
                  {expanded ? "expand_less" : "expand_more"}
                </span>
                {expanded ? "Hide" : "Show"} all refined sections
              </button>

              {expanded && (
                <div className="space-y-3 pt-1 border-t border-outline">
                  {Object.entries(body).map(([key, val]) => {
                    if (!val) return null;
                    const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                    if (Array.isArray(val)) {
                      return (
                        <div key={key}>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">{label}</p>
                          <ul className="space-y-0.5">
                            {val.map((item, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-[11px] text-on-surface-variant">
                                <span className="text-primary mt-0.5 shrink-0">·</span>{item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    }
                    return (
                      <div key={key}>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">{label}</p>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed bg-surface-container border border-outline rounded-lg px-3 py-2">{val}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FeatureHardeningWorkflow({ onNavigate, project }) {
  const projectId = project?.id ?? null;

  // Phase: source | running | review | syncing | done
  const [phase, setPhase]           = useState("source");
  const [workflowId, setWorkflowId] = useState(() => loadCurrentWorkflowId());

  // Jira
  const [jiraState, setJiraState]       = useState("checking"); // checking | connected | disconnected
  const [jiraProjects, setJiraProjects] = useState([]);

  // Source selections
  const [selectedProjectKey, setSelectedProjectKey] = useState("");
  const [epics, setEpics]                           = useState([]);
  const [loadingEpics, setLoadingEpics]             = useState(false);
  const [epicsError, setEpicsError]                 = useState(null);
  const [selectedKeys, setSelectedKeys]             = useState(new Set());
  const [refinementGoal, setRefinementGoal]         = useState("");
  const [constraints, setConstraints]               = useState("");

  // Results
  const [results, setResults]           = useState([]);
  const [overallSummary, setOverallSummary] = useState("");
  const [approvedKeys, setApprovedKeys] = useState(new Set());

  // Run progress
  const [progress, setProgress] = useState({ message: "Starting…", pct: 5 });

  // Publish
  const [publishResult, setPublishResult] = useState(null);

  const [error, setError] = useState(null);
  const socketRef        = useRef(null);
  // Refs for async callbacks — hold latest source + hardening response
  // so the publish PATCH can write all three state_payload keys together
  const sourcePaylRef    = useRef(null);
  const hardeningResRef  = useRef(null);

  // ── On mount: check Jira + restore if workflow already exists ──────────────
  useEffect(() => {
    checkJira();
    if (workflowId) restoreFromWorkflow(workflowId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { socketRef.current?.close(); };
  }, []);

  async function checkJira() {
    try {
      const status = await getJiraStatus();
      if (status?.connected) {
        setJiraState("connected");
        try {
          const data = await getJiraProjects();
          setJiraProjects(Array.isArray(data) ? data : (data.projects ?? []));
        } catch { /* projects load is best-effort */ }
      } else {
        setJiraState("disconnected");
      }
    } catch {
      setJiraState("disconnected");
    }
  }

  async function restoreFromWorkflow(id) {
    try {
      const wf = await getWorkflow(id);
      const payload = wf.state_payload ?? {};
      const resultsData = payload.feature_hardening_results ?? null;
      const sourceData  = payload.feature_hardening_source  ?? null;

      if (resultsData?.results?.length > 0) {
        setResults(resultsData.results);
        setOverallSummary(resultsData.hardening_summary ?? "");
        setApprovedKeys(new Set(
          resultsData.results.map(r => r.issue_key).filter(Boolean)
        ));
        setPhase(wf.current_step === "sync" ? "done" : "review");
      } else if (sourceData) {
        if (sourceData.jira_project_key) setSelectedProjectKey(sourceData.jira_project_key);
        setPhase("source");
      }
    } catch { /* ignore restore errors */ }
  }

  // ── Source step helpers ───────────────────────────────────────────────────
  async function handleLoadEpics() {
    if (!selectedProjectKey.trim()) return;
    setLoadingEpics(true);
    setEpicsError(null);
    setEpics([]);
    setSelectedKeys(new Set());
    try {
      const data = await getFeatureHardeningSource(selectedProjectKey.trim());
      // Backend returns { features: JiraFeatureSource[] }
      const list = Array.isArray(data) ? data : (data.features ?? []);
      setEpics(list);
    } catch (e) {
      setEpicsError(e.message);
    } finally {
      setLoadingEpics(false);
    }
  }

  function toggleEpic(key) {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < MAX_EPICS) {
        next.add(key);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedKeys.size === Math.min(epics.length, MAX_EPICS)) {
      setSelectedKeys(new Set());
    } else {
      // Only select up to MAX_EPICS — backend hard-limits to 8
      setSelectedKeys(new Set(epics.slice(0, MAX_EPICS).map(e => e.issue_key ?? e.key)));
    }
  }

  function toggleApprove(key) {
    setApprovedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Start hardening job ───────────────────────────────────────────────────
  async function handleStartHardening() {
    if (selectedKeys.size === 0) return;
    setError(null);
    setPhase("running");
    setProgress({ message: "Creating workflow run…", pct: 5 });

    const sourcePayload = {
      jira_project_key: selectedProjectKey,
      issue_keys: Array.from(selectedKeys),
    };
    sourcePaylRef.current = sourcePayload;

    try {
      // Create workflow run if needed
      let wfId = workflowId;
      if (!wfId) {
        const wf = await createWorkflow({
          workflow_type: "feature_hardening",
          workflow_definition_key: "feature_hardening",
          workflow_definition_label: "Feature Hardening",
          project_id: projectId,
          current_step: "source",
          status: "active",
        });
        wfId = wf.id ?? wf.workflow_id;
        storeCurrentWorkflowId(wfId);
        setWorkflowId(wfId);
      }

      // Persist source step
      await updateWorkflow(wfId, {
        current_step: "source",
        state_payload: { feature_hardening_source: sourcePayload },
      });

      setProgress({ message: "Launching hardening job…", pct: 12 });

      const jobRes = await startFeatureHardeningJob({
        project_id: projectId,
        workflow_id: wfId,
        source_type: "jira_project",
        jira_project_key: selectedProjectKey,
        issue_keys: Array.from(selectedKeys),
        ...(refinementGoal.trim() ? { refinement_goal: refinementGoal.trim() } : {}),
        // Backend expects constraints: list[str] — split comma-separated input
        ...(constraints.trim() ? {
          constraints: constraints.split(",").map(s => s.trim()).filter(Boolean),
        } : {}),
      });

      // Backend returns { job: GenerationJob } — ID is job.id
      const jobId = jobRes.job?.id;
      if (!jobId) throw new Error("No job ID returned from server");

      setProgress({ message: "Hardening features…", pct: 20 });

      // Open WebSocket
      const ws = openJobSocket(jobId);
      socketRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          // Backend sends { event: "job.updated", job: { status, result_payload, progress_message, error_message } }
          const job = msg.job ?? msg;
          if (job.status === "completed" && job.result_payload) {
            ws.close();
            applyResults(job.result_payload, wfId, sourcePayload);
          } else if (job.status === "failed") {
            ws.close();
            setError(job.error_message ?? "Hardening job failed");
            setPhase("source");
          } else if (job.progress_message) {
            setProgress(p => ({
              message: job.progress_message,
              pct: Math.min((p.pct ?? 20) + 8, 88),
            }));
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = () => {
        ws.close();
        pollJob(jobId, wfId, sourcePayload);
      };

    } catch (e) {
      setError(e.message);
      setPhase("source");
    }
  }

  function applyResults(res, wfId, sourcePayload) {
    const items = res.results ?? [];
    hardeningResRef.current = res; // keep for publish PATCH merge
    setResults(items);
    setOverallSummary(res.hardening_summary ?? "");
    setApprovedKeys(new Set(items.map(r => r.issue_key).filter(Boolean)));
    updateWorkflow(wfId, {
      current_step: "review",
      state_payload: {
        feature_hardening_source: sourcePayload,
        feature_hardening_results: res,
      },
    }).catch(() => {});
    setPhase("review");
  }

  async function pollJob(jobId, wfId, sourcePayload) {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const job = await getGenerationJob(jobId);
        setProgress({ message: job.progress_message ?? "Hardening…", pct: Math.min(20 + i * 5, 88) });
        if (job.status === "completed" && job.result_payload) {
          applyResults(job.result_payload, wfId, sourcePayload);
          return;
        }
        if (job.status === "failed") {
          setError(job.error_message ?? "Hardening job failed");
          setPhase("source");
          return;
        }
      } catch { /* continue polling */ }
    }
    setError("Job timed out — please try again");
    setPhase("source");
  }

  // ── Publish ───────────────────────────────────────────────────────────────
  async function handlePublish() {
    const approvedResults = results.filter(r =>
      approvedKeys.has(r.issue_key ?? r.source_key)
    );
    if (approvedResults.length === 0) return;
    setPhase("syncing");
    setError(null);
    try {
      const res = await publishFeatureHardening({
        project_id: projectId,
        workflow_id: workflowId,
        jira_project_key: selectedProjectKey,
        results: approvedResults.map(r => ({
          issue_key: r.issue_key,
          refined_feature: r.refined_feature,
        })),
      });
      setPublishResult(res);
      if (workflowId) {
        // Include all three keys — PATCH replaces state_payload wholesale,
        // so we must re-send source and results to avoid wiping them
        updateWorkflow(workflowId, {
          current_step: "sync",
          status: "completed",
          state_payload: {
            feature_hardening_source:  sourcePaylRef.current ?? {},
            feature_hardening_results: hardeningResRef.current ?? {},
            feature_hardening_publish: res,
          },
        }).catch(() => {});
      }
      setPhase("done");
    } catch (e) {
      setError(e.message);
      setPhase("review");
    }
  }

  // ── Flowbar step mapping ──────────────────────────────────────────────────
  const flowStep =
    phase === "running" ? "source" :
    phase === "syncing" ? "sync"   :
    phase === "done"    ? "sync"   :
    phase;

  const approvedCount = approvedKeys.size;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="px-8 py-8">

      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => onNavigate?.("project-detail")}
          className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to project
        </button>
        <span className="text-on-surface-variant text-sm">·</span>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[14px] text-orange-600"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              build
            </span>
          </div>
          <h2 className="text-lg font-headline font-bold text-on-surface">Feature Hardening</h2>
          <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container border border-outline px-2 py-0.5 rounded-full">
            Workflow
          </span>
        </div>
      </div>

      {/* Flowbar */}
      <FlowBar current={flowStep} />

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined text-error text-[18px]">error</span>
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-semibold text-red-600 hover:text-red-700 shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Source step ──────────────────────────────────────────────────────── */}
      {phase === "source" && (
        <div className="space-y-5">

          {/* Jira checking */}
          {jiraState === "checking" && (
            <div className="p-5 bg-surface-container border border-outline rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-container animate-pulse" />
              <p className="text-sm text-on-surface-variant">Checking Jira connection…</p>
            </div>
          )}

          {/* Jira disconnected */}
          {jiraState === "disconnected" && (
            <div className="p-5 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-4">
              <span className="material-symbols-outlined text-[20px] text-amber-500">warning</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-on-surface">Jira not connected</p>
                <p className="text-[12px] text-on-surface-variant">
                  Connect Jira in Connectors to load epics for hardening.
                </p>
              </div>
              <button
                onClick={() => onNavigate?.("connectors")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0052CC] text-white text-[11px] font-bold rounded-lg hover:bg-[#0043A6] transition-all shrink-0"
              >
                <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                Connect Jira
              </button>
            </div>
          )}

          {/* Connected — two-panel: controls left, epic list right */}
          {jiraState === "connected" && (
            <div className="grid grid-cols-[2fr_3fr] gap-6 items-start">

              {/* Left: project picker + optional settings + CTA */}
              <div className="bg-surface border border-outline rounded-2xl p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-headline font-bold text-on-surface mb-1">
                    Source Jira Project
                  </h3>
                  <p className="text-[12px] text-on-surface-variant">
                    Choose the project and select the epics you want to harden.
                  </p>
                </div>

                <div className="space-y-2">
                  {jiraProjects.length > 0 ? (
                    <select
                      value={selectedProjectKey}
                      onChange={(e) => {
                        setSelectedProjectKey(e.target.value);
                        setEpics([]);
                        setSelectedKeys(new Set());
                      }}
                      className="w-full px-3 py-2 bg-surface-container border border-outline rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="">— Select a project —</option>
                      {jiraProjects.map(p => (
                        <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={selectedProjectKey}
                      onChange={(e) => setSelectedProjectKey(e.target.value.toUpperCase())}
                      placeholder="e.g. PROJ"
                      className="w-full px-3 py-2 bg-surface-container border border-outline rounded-lg text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary font-mono"
                    />
                  )}
                  <button
                    onClick={handleLoadEpics}
                    disabled={!selectedProjectKey.trim() || loadingEpics}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dim transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    {loadingEpics ? (
                      <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[14px]">cloud_download</span>
                    )}
                    Load Epics
                  </button>
                </div>

                {epicsError && (
                  <p className="text-[12px] text-red-600 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[13px]">error</span>
                    {epicsError}
                  </p>
                )}

                {/* Optional fields + CTA — visible once epics are loaded */}
                {epics.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-outline">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                        Refinement Goal <span className="normal-case font-normal tracking-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={refinementGoal}
                        onChange={(e) => setRefinementGoal(e.target.value)}
                        placeholder="e.g. Focus on mobile UX"
                        className="w-full px-3 py-2 bg-surface-container border border-outline rounded-lg text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                        Constraints <span className="normal-case font-normal tracking-normal">(optional, comma-separated)</span>
                      </label>
                      <input
                        type="text"
                        value={constraints}
                        onChange={(e) => setConstraints(e.target.value)}
                        placeholder="e.g. Q3 deadline, mobile-first, no new APIs"
                        className="w-full px-3 py-2 bg-surface-container border border-outline rounded-lg text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary"
                      />
                    </div>
                    <button
                      onClick={handleStartHardening}
                      disabled={selectedKeys.size === 0}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span
                        className="material-symbols-outlined text-[16px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        build
                      </span>
                      {selectedKeys.size > 0
                        ? `Harden ${selectedKeys.size} Epic${selectedKeys.size !== 1 ? "s" : ""}`
                        : "Select epics to harden"}
                    </button>
                  </div>
                )}
              </div>

              {/* Right: epic list */}
              <div className="bg-surface border border-outline rounded-2xl p-6">
                {epics.length === 0 && !loadingEpics && (
                  <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
                    <div className="w-12 h-12 rounded-xl bg-surface-container border border-outline flex items-center justify-center">
                      <span className="material-symbols-outlined text-[24px] text-on-surface-variant/40">cloud_download</span>
                    </div>
                    <p className="text-[13px] font-semibold text-on-surface-variant">No epics loaded</p>
                    <p className="text-[11px] text-on-surface-variant/70">
                      Select a project and click "Load Epics" to see available features.
                    </p>
                  </div>
                )}
                {loadingEpics && (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <span className="material-symbols-outlined text-[32px] text-primary/40 animate-spin">progress_activity</span>
                    <p className="text-[12px] text-on-surface-variant">Loading epics from Jira…</p>
                  </div>
                )}
                {epics.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {epics.length} Epic{epics.length !== 1 ? "s" : ""} — {selectedKeys.size}/{MAX_EPICS} selected
                        {selectedKeys.size >= MAX_EPICS && (
                          <span className="ml-1.5 text-amber-600 normal-case font-normal tracking-normal">(limit reached)</span>
                        )}
                      </p>
                      <button
                        onClick={toggleAll}
                        className="text-[11px] font-semibold text-primary hover:text-primary-dim"
                      >
                        {selectedKeys.size === Math.min(epics.length, MAX_EPICS) ? "Deselect all" : "Select all"}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-[calc(100vh-20rem)] overflow-y-auto pr-1">
                      {epics.map(epic => (
                        <EpicRow
                          key={epic.issue_key ?? epic.key}
                          epic={epic}
                          selected={selectedKeys.has(epic.issue_key ?? epic.key)}
                          onToggle={toggleEpic}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* ── Running phase ─────────────────────────────────────────────────────── */}
      {phase === "running" && (
        <div className="bg-surface border border-outline rounded-2xl p-12 flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-[32px] text-orange-500 animate-pulse"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              build
            </span>
          </div>
          <div className="text-center">
            <p className="text-base font-headline font-bold text-on-surface mb-1">Hardening Features…</p>
            <p className="text-[13px] text-on-surface-variant max-w-xs">{progress.message}</p>
          </div>
          <div className="w-full max-w-sm">
            <div className="h-2 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all duration-700"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            Evaluating and refining selected Jira epics against feature quality criteria…
          </p>
        </div>
      )}

      {/* ── Review step ───────────────────────────────────────────────────────── */}
      {phase === "review" && (
        <div className="space-y-6">

          {/* Section header */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-headline font-bold text-on-surface">
                {results.length} Feature{results.length !== 1 ? "s" : ""} Hardened
              </h3>
              <p className="text-[12px] text-on-surface-variant mt-0.5">
                Review and approve refined features before publishing back to Jira.
              </p>
            </div>
            <button
              onClick={handlePublish}
              disabled={approvedCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-[#0052CC] text-white text-sm font-bold rounded-lg hover:bg-[#0043A6] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
              Publish {approvedCount > 0 ? approvedCount : ""} to Jira
            </button>
          </div>

          {/* Overall summary */}
          {overallSummary && (
            <div className="flex items-start gap-2 px-4 py-3 bg-primary/5 border border-primary/15 rounded-xl">
              <span className="material-symbols-outlined text-[14px] text-primary mt-0.5 shrink-0">summarize</span>
              <p className="text-[12px] text-on-surface leading-relaxed">{overallSummary}</p>
            </div>
          )}

          {/* Result cards */}
          <div className="space-y-4">
            {results.map((result, i) => (
              <ResultCard
                key={result.issue_key ?? result.source_key ?? i}
                result={result}
                approved={approvedKeys.has(result.issue_key ?? result.source_key)}
                onToggleApprove={toggleApprove}
              />
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handlePublish}
              disabled={approvedCount === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0052CC] text-white text-sm font-bold rounded-lg hover:bg-[#0043A6] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
              Publish {approvedCount} Approved to Jira
            </button>
          </div>
        </div>
      )}

      {/* ── Syncing phase ─────────────────────────────────────────────────────── */}
      {phase === "syncing" && (
        <div className="bg-surface border border-outline rounded-2xl p-12 flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-[#0052CC]/10 border border-[#0052CC]/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-[#0052CC] animate-pulse">
              cloud_upload
            </span>
          </div>
          <div className="text-center">
            <p className="text-base font-headline font-bold text-on-surface mb-1">Publishing to Jira…</p>
            <p className="text-[13px] text-on-surface-variant">
              Pushing {approvedCount} hardened feature{approvedCount !== 1 ? "s" : ""} back to your Jira epics.
            </p>
          </div>
        </div>
      )}

      {/* ── Done ──────────────────────────────────────────────────────────────── */}
      {phase === "done" && (
        <div className="space-y-5">
          <div className="bg-surface border border-green-200 rounded-2xl p-10 flex flex-col items-center gap-5 text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 border border-green-100 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-[32px] text-green-600"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            </div>
            <div>
              <p className="text-lg font-headline font-bold text-on-surface mb-1">Hardening Complete</p>
              <p className="text-[13px] text-on-surface-variant">
                {approvedCount} feature{approvedCount !== 1 ? "s" : ""} published back to Jira successfully.
              </p>
            </div>

            {publishResult?.results?.length > 0 && (
              <div className="w-full text-left space-y-2">
                {publishResult.results.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-100 rounded-xl">
                    <span
                      className="material-symbols-outlined text-[16px] text-green-600"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span className="text-[11px] font-bold text-on-surface font-mono">{item.issue_key}</span>
                    {item.issue_url && (
                      <a
                        href={item.issue_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-[#0052CC] hover:underline ml-auto"
                      >
                        View in Jira
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => onNavigate?.("project-detail")}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dim transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to project
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
