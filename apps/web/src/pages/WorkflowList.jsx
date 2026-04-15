import { useState, useEffect } from "react";
import { getWorkflows, updateWorkflow, restoreWorkflowState, clearWorkflowState } from "../api/workflows";
import { getProject } from "../api/projects";

// ─── Pipeline definition ──────────────────────────────────────────────────────
const PIPELINE_STEPS = ["workshop", "opportunity", "shaping", "artifacts", "stories", "jira"];
const STEP_VIEW_MAP = {
  workshop: "workshop",
  validation: "opportunity",
  opportunity: "opportunity",
  shaping: "shaping",
  artifacts: "artifacts",
  stories: "stories",
  jira: "jira",
};

const STEP_CONFIG = {
  workshop:    { label: "Workshop",   icon: "groups"          },
  opportunity: { label: "Validation", icon: "search_insights" },
  shaping:     { label: "Shaping",    icon: "architecture"    },
  artifacts:   { label: "Artifacts",  icon: "auto_awesome"    },
  stories:     { label: "Stories",    icon: "receipt_long"    },
  jira:        { label: "Jira",       icon: "cloud_upload"    },
};

const STATUS_STYLE = {
  active:    "bg-blue-50 text-blue-600 border-blue-100",
  completed: "bg-green-50 text-green-600 border-green-100",
  draft:     "bg-slate-100 text-slate-500 border-slate-200",
};

function relativeTime(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function stepIndex(step) {
  const idx = PIPELINE_STEPS.indexOf(STEP_VIEW_MAP[step] ?? step);
  return idx >= 0 ? idx : 0;
}

// ─── Workflow card ─────────────────────────────────────────────────────────────
function WorkflowCard({ workflow, onResume, onRename }) {
  const resolvedStep = STEP_VIEW_MAP[workflow.current_step] ?? workflow.current_step ?? "workshop";
  const currentIdx   = stepIndex(resolvedStep);
  const isCompleted  = workflow.status === "completed";
  const stepCfg      = STEP_CONFIG[resolvedStep] ?? STEP_CONFIG.workshop;
  const created      = relativeTime(workflow.created_at);

  const [renaming, setRenaming]   = useState(false);
  const [draftName, setDraftName] = useState(workflow.title || "");

  function startRename() {
    setDraftName(workflow.title || "");
    setRenaming(true);
  }

  function commitRename() {
    setRenaming(false);
    const name = draftName.trim();
    if (name && name !== workflow.title) onRename(workflow.id, name);
  }

  function handleRenameKey(e) {
    if (e.key === "Enter")  e.target.blur();
    if (e.key === "Escape") { setRenaming(false); setDraftName(workflow.title || ""); }
  }

  return (
    <div className="bg-surface border border-outline rounded-xl overflow-hidden shadow-card transition-all hover:shadow-md hover:border-primary/30 flex flex-col">

      {/* Top accent stripe */}
      <div className={[
        "h-[3px] shrink-0",
        isCompleted
          ? "bg-gradient-to-r from-green-400 to-emerald-300"
          : "bg-gradient-to-r from-primary via-blue-400 to-blue-300",
      ].join(" ")} />

      <div className="p-5 flex flex-col gap-4 flex-1">

        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={[
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
              isCompleted ? "bg-green-50 border-green-100" : "bg-primary/10 border-primary/20",
            ].join(" ")}>
              <span
                className={`material-symbols-outlined text-[18px] ${isCompleted ? "text-green-600" : "text-primary"}`}
                style={isCompleted ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {isCompleted ? "check_circle" : "groups"}
              </span>
            </div>
            <div className="min-w-0">
              {renaming ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleRenameKey}
                  className="text-sm font-headline font-bold text-on-surface bg-transparent border-b border-primary outline-none leading-snug w-full"
                />
              ) : (
                <div className="flex items-center gap-1.5 group/title">
                  <p className="text-sm font-headline font-bold text-on-surface leading-snug truncate">
                    {workflow.title || "Untitled Workshop"}
                  </p>
                  <button
                    onClick={startRename}
                    className="opacity-0 group-hover/title:opacity-100 transition-opacity text-on-surface-variant hover:text-primary shrink-0"
                  >
                    <span className="material-symbols-outlined text-[13px]">edit</span>
                  </button>
                </div>
              )}
              {created && (
                <p className="text-[11px] text-on-surface-variant mt-0.5">{created}</p>
              )}
            </div>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[workflow.status] ?? STATUS_STYLE.draft}`}>
            {workflow.status ?? "draft"}
          </span>
        </div>

        {/* Step progress — dot-and-line nodes */}
        <div className="flex items-start">
          {PIPELINE_STEPS.map((step, i) => {
            const done    = i < currentIdx || isCompleted;
            const current = i === currentIdx && !isCompleted;
            const isLast  = i === PIPELINE_STEPS.length - 1;
            const cfg     = STEP_CONFIG[step];
            return (
              <div key={step} className="flex-1 flex flex-col items-center">
                {/* Dot + connector line */}
                <div className="w-full flex items-center">
                  <div className={[
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 transition-all",
                    done    ? "bg-primary shadow-sm"                          :
                    current ? "bg-primary ring-[3px] ring-primary/20 shadow-sm" :
                              "bg-surface-container border border-outline",
                  ].join(" ")}>
                    {done ? (
                      <span
                        className="material-symbols-outlined text-[10px] text-white"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check
                      </span>
                    ) : (
                      <span className={`material-symbols-outlined text-[9px] ${current ? "text-white" : "text-on-surface-variant"}`}>
                        {cfg.icon}
                      </span>
                    )}
                  </div>
                  {!isLast && (
                    <div className={`flex-1 h-[2px] ${done ? "bg-primary" : "bg-outline"}`} />
                  )}
                </div>
                {/* Step label */}
                <p className={[
                  "text-[8px] font-bold uppercase tracking-wider mt-1.5 text-center w-full",
                  done    ? "text-primary"                  :
                  current ? "text-on-surface"               :
                            "text-on-surface-variant/40",
                ].join(" ")}>
                  {cfg.label.slice(0, 4)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-outline mt-auto">
          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
            <span className="material-symbols-outlined text-[13px]">{stepCfg.icon}</span>
            <span>{isCompleted ? "Completed" : `Paused at ${stepCfg.label}`}</span>
          </div>
          {isCompleted ? (
            <button
              onClick={() => onResume(workflow)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container text-on-surface text-[11px] font-bold rounded-lg border border-outline hover:border-primary hover:text-primary transition-all"
            >
              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
              View
            </button>
          ) : (
            <button
              onClick={() => onResume(workflow)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-lg hover:bg-primary-dim transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[13px]">play_arrow</span>
              Resume
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-surface border border-outline rounded-xl overflow-hidden animate-pulse">
      <div className="h-[3px] bg-surface-container" />
      <div className="p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-surface-container" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3.5 w-36 bg-surface-container rounded" />
            <div className="h-2.5 w-16 bg-surface-container rounded" />
          </div>
          <div className="h-5 w-12 bg-surface-container rounded-full" />
        </div>
        <div className="flex items-center gap-0 mb-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-1 flex items-center">
              <div className="w-5 h-5 rounded-full bg-surface-container shrink-0" />
              {i < 5 && <div className="flex-1 h-[2px] bg-surface-container" />}
            </div>
          ))}
        </div>
        <div className="h-px bg-surface-container mb-3" />
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 bg-surface-container rounded" />
          <div className="h-7 w-20 bg-surface-container rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
// projectId — when set, filters to a single project's workflows
// embedded  — when true, hides the page header/padding (for use inside ProjectDetail)
// onNewWorkshop — when set, overrides the default "New Workshop" navigation handler
export default function WorkflowList({ onNavigate, projectId = null, embedded = false, onNewWorkshop = null }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkflows("workshop", projectId);
      // API may return { workflows: [...] } or an array directly
      setWorkflows(Array.isArray(data) ? data : (data.workflows ?? []));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResume(workflow) {
    restoreWorkflowState(workflow);
    const step = STEP_VIEW_MAP[workflow.current_step] ?? "workshop";
    if (workflow.project_id) {
      try {
        const project = await getProject(workflow.project_id);
        onNavigate?.(step, project);
        return;
      } catch { /* fall through */ }
    }
    onNavigate?.(step);
  }

  async function handleRename(id, newTitle) {
    try {
      await updateWorkflow(id, { title: newTitle });
      await load();
    } catch { /* title reverts on next load */ }
  }

  function handleNewWorkshop() {
    clearWorkflowState();
    if (onNewWorkshop) onNewWorkshop();
    else onNavigate?.("workshop");
  }

  const activeWorkflows    = workflows.filter(w => w.status === "active" || w.status === "draft");
  const completedWorkflows = workflows.filter(w => w.status === "completed");

  // ─── Embedded mode (inside ProjectDetail) ────────────────────────────────────
  if (embedded) {
    return (
      <div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
            <span className="material-symbols-outlined text-error text-[16px]">error</span>
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={load} className="ml-auto text-xs font-semibold text-red-600 hover:text-red-700">Retry</button>
          </div>
        )}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px] text-on-surface-variant">groups</span>
            </div>
            <p className="text-sm font-semibold text-on-surface">No workshops yet</p>
            <p className="text-[12px] text-on-surface-variant">Start a workshop to begin the discovery pipeline.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map(wf => (
              <WorkflowCard key={wf.id} workflow={wf} onResume={handleResume} onRename={handleRename} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Full page mode ───────────────────────────────────────────────────────────
  return (
    <div className="px-10 py-10 max-w-5xl">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface mb-2">
            Workflows
          </h2>
          <p className="text-on-surface-variant text-sm max-w-xl leading-relaxed">
            Resume a previous workshop run or start a new one. All pipeline progress is automatically saved at each step.
          </p>
        </div>
        <button
          onClick={handleNewWorkshop}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dim transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Workshop
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined text-error text-[18px]">error</span>
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={load} className="ml-auto text-xs font-semibold text-red-600 hover:text-red-700">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : workflows.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant">history</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-on-surface mb-1">No workflows yet</p>
            <p className="text-[12px] text-on-surface-variant">
              Start a new workshop to begin the product discovery pipeline.
            </p>
          </div>
          <button
            onClick={handleNewWorkshop}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dim transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Workshop
          </button>
        </div>
      ) : (
        <>
          {/* ── Active / in-progress ── */}
          {activeWorkflows.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">pending</span>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  In Progress
                </h3>
                <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full border border-outline">
                  {activeWorkflows.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeWorkflows.map(wf => (
                  <WorkflowCard key={wf.id} workflow={wf} onResume={handleResume} onRename={handleRename} />
                ))}
              </div>
            </section>
          )}

          {/* ── Completed ── */}
          {completedWorkflows.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">check_circle</span>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Completed
                </h3>
                <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full border border-outline">
                  {completedWorkflows.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedWorkflows.map(wf => (
                  <WorkflowCard key={wf.id} workflow={wf} onResume={handleResume} onRename={handleRename} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
