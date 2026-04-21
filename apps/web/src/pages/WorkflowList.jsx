import { useState, useEffect } from "react";
import { getWorkflows, updateWorkflow, restoreWorkflowState, clearWorkflowState } from "../api/workflows";
import { getProject } from "../api/projects";

// ─── Pipeline step configs ────────────────────────────────────────────────────
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

const FEATURE_HARDENING_STEPS = ["source", "review", "sync"];
const BACKLOG_REFINEMENT_STEPS = ["source", "analyze", "review", "done"];
const FEATURE_HARDENING_STEP_CONFIG = {
  source: { label: "Source", icon: "cloud_download" },
  review: { label: "Review", icon: "rate_review"    },
  sync:   { label: "Sync",   icon: "cloud_upload"   },
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

const BACKLOG_REFINEMENT_STEP_CONFIG = {
  source:  { label: "Source",  icon: "cloud_download" },
  analyze: { label: "Analyze", icon: "analytics"      },
  review:  { label: "Review",  icon: "category"       },
  done:    { label: "Done",    icon: "task_alt"        },
};

function workflowVisualConfig(workflow) {
  if (workflow.workflow_type === "backlog_refinement") {
    return {
      steps:      BACKLOG_REFINEMENT_STEPS,
      stepMap:    { source: "source", analyze: "analyze", review: "review", done: "done" },
      stepConfig: BACKLOG_REFINEMENT_STEP_CONFIG,
      icon:         "category",
      defaultTitle: "Untitled Backlog Refinement Run",
    };
  }
  if (workflow.workflow_type === "feature_hardening") {
    return {
      steps:     FEATURE_HARDENING_STEPS,
      stepMap:   { source: "source", review: "review", sync: "sync" },
      stepConfig: FEATURE_HARDENING_STEP_CONFIG,
      icon:         "build",
      defaultTitle: "Untitled Feature Hardening Run",
    };
  }
  return {
    steps:     PIPELINE_STEPS,
    stepMap:   STEP_VIEW_MAP,
    stepConfig: STEP_CONFIG,
    icon:         "groups",
    defaultTitle: "Untitled Workshop",
  };
}

// ─── Workflow run card ────────────────────────────────────────────────────────
function WorkflowCard({ workflow, onResume, onRename }) {
  const visualCfg    = workflowVisualConfig(workflow);
  const resolvedStep = visualCfg.stepMap[workflow.current_step] ?? workflow.current_step ?? visualCfg.steps[0];
  const currentIdx   = Math.max(visualCfg.steps.indexOf(resolvedStep), 0);
  const isCompleted  = workflow.status === "completed";
  const stepCfg      = visualCfg.stepConfig[resolvedStep] ?? visualCfg.stepConfig[visualCfg.steps[0]];
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
                {isCompleted ? "check_circle" : visualCfg.icon}
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
                    {workflow.title || visualCfg.defaultTitle}
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

        {/* Step progress dots */}
        <div className="flex items-start">
          {visualCfg.steps.map((step, i) => {
            const done    = i < currentIdx || isCompleted;
            const current = i === currentIdx && !isCompleted;
            const isLast  = i === visualCfg.steps.length - 1;
            const cfg     = visualCfg.stepConfig[step];
            return (
              <div key={step} className="flex-1 flex flex-col items-center">
                <div className="w-full flex items-center">
                  <div className={[
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 transition-all",
                    done    ? "bg-primary shadow-sm"                             :
                    current ? "bg-primary ring-[3px] ring-primary/20 shadow-sm" :
                              "bg-surface-container border border-outline",
                  ].join(" ")}>
                    {done ? (
                      <span className="material-symbols-outlined text-[10px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                    ) : (
                      <span className={`material-symbols-outlined text-[9px] ${current ? "text-white" : "text-on-surface-variant"}`}>
                        {cfg.icon}
                      </span>
                    )}
                  </div>
                  {!isLast && <div className={`flex-1 h-[2px] ${done ? "bg-primary" : "bg-outline"}`} />}
                </div>
                <p className={[
                  "text-[8px] font-bold uppercase tracking-wider mt-1.5 text-center w-full",
                  done ? "text-primary" : current ? "text-on-surface" : "text-on-surface-variant/40",
                ].join(" ")}>
                  {cfg.label.slice(0, 4)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-outline mt-auto">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
              <span className="material-symbols-outlined text-[13px]">{stepCfg.icon}</span>
              <span>{isCompleted ? "Completed" : `Paused at ${stepCfg.label}`}</span>
            </div>
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

// ─── Workflow definition configs ──────────────────────────────────────────────
const DEFS = {
  d2d: {
    key:         "d2d",
    name:        "Discovery to Delivery",
    icon:        "route",
    description: "End-to-end pipeline from raw workshop insights to prioritized, refined Jira stories — guided by AI agents at every step.",
    steps: [
      { key: "workshop",   label: "Workshop",   icon: "groups"          },
      { key: "validation", label: "Validation", icon: "search_insights" },
      { key: "shaping",    label: "Shaping",    icon: "architecture"    },
      { key: "artifacts",  label: "Artifacts",  icon: "auto_awesome"    },
      { key: "stories",    label: "Stories",    icon: "receipt_long"    },
      { key: "jira",       label: "Jira",       icon: "cloud_upload"    },
    ],
    gradient:    "from-primary/[0.07] via-blue-500/[0.03] to-transparent",
    iconBg:      "bg-primary/10",
    iconBorder:  "border-primary/20",
    iconColor:   "text-primary",
    badge:       "bg-primary/10 text-primary border border-primary/20",
    stripe:      "from-primary to-blue-400",
    btnClass:    "bg-primary hover:bg-primary-dim",
  },
  fh: {
    key:         "fh",
    name:        "Feature Hardening",
    icon:        "build",
    description: "Pull existing Jira epics and let AI evaluate and harden them against your feature quality standards before delivery.",
    steps: [
      { key: "source", label: "Source", icon: "cloud_download" },
      { key: "review", label: "Review", icon: "rate_review"    },
      { key: "sync",   label: "Sync",   icon: "cloud_upload"   },
    ],
    gradient:    "from-orange-50/80 via-amber-50/30 to-transparent",
    iconBg:      "bg-orange-50",
    iconBorder:  "border-orange-200",
    iconColor:   "text-orange-600",
    badge:       "bg-orange-100 text-orange-700 border border-orange-200",
    stripe:      "from-orange-500 to-amber-400",
    btnClass:    "bg-orange-500 hover:bg-orange-600",
  },
  br: {
    key:         "br",
    name:        "Backlog Refinement",
    icon:        "category",
    description: "Inspect your Jira backlog against team velocity, route every story into Generate / Refine / Slice / Ready, and approve the plan before anything runs.",
    steps: [
      { key: "source",  label: "Source",  icon: "cloud_download" },
      { key: "analyze", label: "Analyze", icon: "analytics"      },
      { key: "review",  label: "Review",  icon: "category"       },
      { key: "done",    label: "Done",    icon: "task_alt"        },
    ],
    gradient:    "from-indigo-50/80 via-violet-50/30 to-transparent",
    iconBg:      "bg-indigo-50",
    iconBorder:  "border-indigo-200",
    iconColor:   "text-indigo-600",
    badge:       "bg-indigo-100 text-indigo-700 border border-indigo-200",
    stripe:      "from-indigo-600 to-violet-500",
    btnClass:    "bg-indigo-600 hover:bg-indigo-700",
  },
};

// ─── Definition card ──────────────────────────────────────────────────────────
function DefinitionCard({ def, runsCount, lastRun, loading, onViewRuns, onNewRun }) {
  return (
    <div className="border border-outline rounded-2xl overflow-hidden shadow-card hover:shadow-lg transition-all bg-surface">

      {/* Accent stripe */}
      <div className={`h-[3px] bg-gradient-to-r ${def.stripe}`} />

      {/* Hero */}
      <div className={`px-8 py-7 bg-gradient-to-br ${def.gradient}`}>
        <div className="flex items-start gap-6">

          {/* Icon */}
          <div className={`w-14 h-14 rounded-2xl ${def.iconBg} border-2 ${def.iconBorder} flex items-center justify-center shrink-0`}>
            <span
              className={`material-symbols-outlined text-[26px] ${def.iconColor}`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {def.icon}
            </span>
          </div>

          {/* Name + description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
              <h3 className="text-xl font-headline font-bold text-on-surface">{def.name}</h3>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ${def.badge}`}>
                Agentic Workflow
              </span>
            </div>
            <p className="text-[13px] text-on-surface-variant leading-relaxed max-w-xl">{def.description}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 shrink-0 pt-1">
            <button
              onClick={onViewRuns}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/70 border border-outline text-[12px] font-bold text-on-surface rounded-lg hover:bg-white hover:border-on-surface/20 transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">history</span>
              {loading ? "…" : `${runsCount} ${runsCount === 1 ? "Run" : "Runs"}`}
            </button>
            <button
              onClick={onNewRun}
              className={`flex items-center gap-1.5 px-4 py-2 ${def.btnClass} text-white text-[12px] font-bold rounded-lg transition-all shadow-sm`}
            >
              <span className="material-symbols-outlined text-[15px]">play_arrow</span>
              New Run
            </button>
          </div>

        </div>
      </div>

      {/* Pipeline steps strip */}
      <div className="px-8 py-4 border-t border-outline flex items-center overflow-x-auto">
        {def.steps.map((step, i) => (
          <div key={step.key} className="flex items-center shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-surface-container border border-outline flex items-center justify-center">
                <span className="material-symbols-outlined text-[13px] text-on-surface-variant">{step.icon}</span>
              </div>
              <span className="text-[12px] font-medium text-on-surface-variant whitespace-nowrap">{step.label}</span>
            </div>
            {i < def.steps.length - 1 && (
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant/30 mx-3">arrow_forward_ios</span>
            )}
          </div>
        ))}
        {lastRun && (
          <span className="ml-auto text-[11px] text-on-surface-variant/60 shrink-0 pl-6">
            Last run {lastRun}
          </span>
        )}
      </div>

    </div>
  );
}

// ─── Runs view ────────────────────────────────────────────────────────────────
function RunsView({ defKey, workflows, loading, onBack, onNewRun, onResume, onRename }) {
  const def       = DEFS[defKey];
  const active    = workflows.filter(w => w.status === "active" || w.status === "draft");
  const completed = workflows.filter(w => w.status === "completed");

  return (
    <div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            All Workflows
          </button>
          <span className="text-on-surface-variant text-sm">·</span>
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg ${def.iconBg} border ${def.iconBorder} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-[14px] ${def.iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                {def.icon}
              </span>
            </div>
            <h3 className="text-lg font-headline font-bold text-on-surface">{def.name}</h3>
            {!loading && (
              <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full border border-outline">
                {workflows.length} {workflows.length === 1 ? "run" : "runs"}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onNewRun}
          className={`flex items-center gap-1.5 px-3.5 py-2 ${def.btnClass} text-white text-[11px] font-bold rounded-lg transition-all shadow-sm`}
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          New Run
        </button>
      </div>

      {/* Run list */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className={`w-16 h-16 rounded-2xl ${def.iconBg} border-2 ${def.iconBorder} flex items-center justify-center`}>
            <span className={`material-symbols-outlined text-[30px] ${def.iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>
              {def.icon}
            </span>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-on-surface mb-1">No runs yet</p>
            <p className="text-[12px] text-on-surface-variant">Start your first run to get going.</p>
          </div>
          <button
            onClick={onNewRun}
            className={`flex items-center gap-2 px-4 py-2 ${def.btnClass} text-white text-sm font-bold rounded-lg transition-all`}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Run
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">pending</span>
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">In Progress</h4>
                <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full border border-outline">{active.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {active.map(wf => <WorkflowCard key={wf.id} workflow={wf} onResume={onResume} onRename={onRename} />)}
              </div>
            </section>
          )}
          {completed.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">check_circle</span>
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Completed</h4>
                <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full border border-outline">{completed.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completed.map(wf => <WorkflowCard key={wf.id} workflow={wf} onResume={onResume} onRename={onRename} />)}
              </div>
            </section>
          )}
        </div>
      )}

    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
// projectId — when set, filters to a single project's workflows
// embedded  — when true, hides the page header/padding (for use inside ProjectDetail)
// onNewWorkshop — when set, overrides the default "New Workshop" navigation handler
// onNewFeatureHardening — when set, overrides default "New Feature Hardening" handler
export default function WorkflowList({ onNavigate, project = null, projectId = null, embedded = false, onNewWorkshop = null, onNewFeatureHardening = null, onNewBacklogRefinement = null }) {
  const [d2dWorkflows, setD2dWorkflows]     = useState([]);
  const [fhWorkflows, setFhWorkflows]       = useState([]);
  const [brWorkflows, setBrWorkflows]       = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [activeDefinition, setActiveDefinition] = useState(null); // null | "d2d" | "fh" | "br"

  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    const [d2dRes, fhRes, brRes] = await Promise.allSettled([
      getWorkflows("workshop", projectId, null, "discovery_to_delivery"),
      getWorkflows("feature_hardening", projectId, null, "feature_hardening"),
      getWorkflows("backlog_refinement", projectId, null, "backlog_refinement"),
    ]);
    setD2dWorkflows(
      d2dRes.status === "fulfilled"
        ? (Array.isArray(d2dRes.value) ? d2dRes.value : (d2dRes.value.workflows ?? []))
        : []
    );
    setFhWorkflows(
      fhRes.status === "fulfilled"
        ? (Array.isArray(fhRes.value) ? fhRes.value : (fhRes.value.workflows ?? []))
        : []
    );
    setBrWorkflows(
      brRes.status === "fulfilled"
        ? (Array.isArray(brRes.value) ? brRes.value : (brRes.value.workflows ?? []))
        : []
    );
    if (d2dRes.status === "rejected" && fhRes.status === "rejected" && brRes.status === "rejected") {
      setError(d2dRes.reason?.message ?? "Failed to load workflows");
    }
    setLoading(false);
  }

  async function handleResume(workflow) {
    restoreWorkflowState(workflow);
    if (workflow.workflow_type === "backlog_refinement") {
      sessionStorage.setItem("backlog_refinement_restore_pending", "true");
      if (workflow.project_id) {
        try {
          const p = await getProject(workflow.project_id);
          onNavigate?.("backlog-refinement", p);
          return;
        } catch { /* fall through */ }
      }
      onNavigate?.("backlog-refinement");
      return;
    }
    if (workflow.workflow_type === "feature_hardening") {
      if (workflow.project_id) {
        try {
          const p = await getProject(workflow.project_id);
          onNavigate?.("feature-hardening", p);
          return;
        } catch { /* fall through */ }
      }
      onNavigate?.("feature-hardening");
      return;
    }
    const step = STEP_VIEW_MAP[workflow.current_step] ?? "workshop";
    if (workflow.project_id) {
      try {
        const p = await getProject(workflow.project_id);
        onNavigate?.(step, p);
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

  function handleNewWorkshopFn() {
    clearWorkflowState();
    if (onNewWorkshop) onNewWorkshop();
    else if (project) onNavigate?.("workshop", project);
    else onNavigate?.("workshop");
  }

  function handleNewFeatureHardeningFn() {
    clearWorkflowState();
    if (onNewFeatureHardening) onNewFeatureHardening();
    else if (project) onNavigate?.("feature-hardening", project);
    else onNavigate?.("feature-hardening");
  }

  function handleNewBacklogRefinementFn() {
    clearWorkflowState();
    if (onNewBacklogRefinement) onNewBacklogRefinement();
    else if (project) onNavigate?.("backlog-refinement", project);
    else onNavigate?.("backlog-refinement");
  }

  function workflowsForDef(key) {
    if (key === "d2d") return d2dWorkflows;
    if (key === "fh")  return fhWorkflows;
    return brWorkflows;
  }

  function lastRunForDef(key) {
    const runs = workflowsForDef(key);
    const sorted = [...runs].sort((a, b) =>
      new Date(b.updated_at ?? b.created_at) - new Date(a.updated_at ?? a.created_at)
    );
    return sorted[0] ? relativeTime(sorted[0].updated_at ?? sorted[0].created_at) : null;
  }

  function newRunForDef(key) {
    if (key === "d2d") return handleNewWorkshopFn;
    if (key === "fh")  return handleNewFeatureHardeningFn;
    return handleNewBacklogRefinementFn;
  }

  // ─── Embedded mode (inside ProjectDetail) ────────────────────────────────────
  if (embedded) {
    if (activeDefinition) {
      return (
        <RunsView
          defKey={activeDefinition}
          workflows={workflowsForDef(activeDefinition)}
          loading={loading}
          onBack={() => setActiveDefinition(null)}
          onNewRun={newRunForDef(activeDefinition)}
          onResume={handleResume}
          onRename={handleRename}
        />
      );
    }
    return (
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
            <span className="material-symbols-outlined text-error text-[16px]">error</span>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={load} className="text-xs font-semibold text-red-600 hover:text-red-700">Retry</button>
          </div>
        )}
        <DefinitionCard
          def={DEFS.d2d}
          runsCount={d2dWorkflows.length}
          lastRun={lastRunForDef("d2d")}
          loading={loading}
          onViewRuns={() => setActiveDefinition("d2d")}
          onNewRun={handleNewWorkshopFn}
        />
        <DefinitionCard
          def={DEFS.fh}
          runsCount={fhWorkflows.length}
          lastRun={lastRunForDef("fh")}
          loading={loading}
          onViewRuns={() => setActiveDefinition("fh")}
          onNewRun={handleNewFeatureHardeningFn}
        />
        <DefinitionCard
          def={DEFS.br}
          runsCount={brWorkflows.length}
          lastRun={lastRunForDef("br")}
          loading={loading}
          onViewRuns={() => setActiveDefinition("br")}
          onNewRun={handleNewBacklogRefinementFn}
        />
      </div>
    );
  }

  // ─── Full page mode ───────────────────────────────────────────────────────────
  if (activeDefinition) {
    return (
      <div className="px-8 py-8">
        <RunsView
          defKey={activeDefinition}
          workflows={workflowsForDef(activeDefinition)}
          loading={loading}
          onBack={() => setActiveDefinition(null)}
          onNewRun={newRunForDef(activeDefinition)}
          onResume={handleResume}
          onRename={handleRename}
        />
      </div>
    );
  }

  return (
    <div className="px-8 py-8">

      {/* Page header */}
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface mb-2">
          Agentic Workflows
        </h2>
        <p className="text-on-surface-variant text-sm leading-relaxed">
          AI-powered workflows that guide your team from discovery to delivery. Each run is automatically saved at every step.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined text-error text-[18px]">error</span>
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={load} className="ml-auto text-xs font-semibold text-red-600 hover:text-red-700">Retry</button>
        </div>
      )}

      {/* Definition cards */}
      <div className="space-y-5">
        <DefinitionCard
          def={DEFS.d2d}
          runsCount={d2dWorkflows.length}
          lastRun={lastRunForDef("d2d")}
          loading={loading}
          onViewRuns={() => setActiveDefinition("d2d")}
          onNewRun={handleNewWorkshopFn}
        />
        <DefinitionCard
          def={DEFS.fh}
          runsCount={fhWorkflows.length}
          lastRun={lastRunForDef("fh")}
          loading={loading}
          onViewRuns={() => setActiveDefinition("fh")}
          onNewRun={handleNewFeatureHardeningFn}
        />
        <DefinitionCard
          def={DEFS.br}
          runsCount={brWorkflows.length}
          lastRun={lastRunForDef("br")}
          loading={loading}
          onViewRuns={() => setActiveDefinition("br")}
          onNewRun={handleNewBacklogRefinementFn}
        />
      </div>

    </div>
  );
}
