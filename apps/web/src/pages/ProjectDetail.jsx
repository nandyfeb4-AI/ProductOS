import { useState, useEffect } from "react";
import WorkflowList from "./WorkflowList";
import { createWorkshop, getWorkshop, getWorkshops } from "../api/workshops";
import { getSkills } from "../api/skills";
import { getProjectFeatures } from "../api/projectFeatures";
import { getProjectStories }  from "../api/projectStories";
import {
  getWorkflow, restoreWorkflowState, clearWorkflowState,
  storeCurrentWorkshopId,
} from "../api/workflows";

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",  label: "Overview",  icon: "grid_view"    },
  { id: "workshops", label: "Workshops", icon: "groups"       },
  { id: "workflows", label: "Workflows", icon: "account_tree" },
  { id: "agents",    label: "Agents",    icon: "smart_toy"    },
  { id: "features",  label: "Features",  icon: "auto_awesome" },
  { id: "backlog",   label: "Stories",   icon: "receipt_long" },
  { id: "roadmap",   label: "Roadmap",   icon: "map"          },
];

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  active:    { label: "Active",    badge: "bg-blue-50 text-blue-600 border-blue-100",     stripe: "from-primary via-blue-400 to-blue-300",    avatar: "from-blue-500 to-primary"      },
  on_hold:   { label: "On Hold",   badge: "bg-amber-50 text-amber-600 border-amber-100",  stripe: "from-amber-400 via-amber-300 to-amber-200", avatar: "from-amber-400 to-amber-500"   },
  completed: { label: "Completed", badge: "bg-green-50 text-green-600 border-green-100",  stripe: "from-green-400 to-emerald-300",             avatar: "from-green-500 to-emerald-600" },
  archived:  { label: "Archived",  badge: "bg-slate-100 text-slate-500 border-slate-200", stripe: "from-slate-300 to-slate-200",               avatar: "from-slate-400 to-slate-500"   },
};

const WORKSHOP_STATUS = {
  active:    { label: "Active",    badge: "bg-blue-50 text-blue-600 border-blue-100",     stripe: "from-primary via-blue-400 to-blue-300"    },
  draft:     { label: "Draft",     badge: "bg-slate-100 text-slate-500 border-slate-200", stripe: "from-slate-300 to-slate-200"               },
  completed: { label: "Completed", badge: "bg-green-50 text-green-600 border-green-100",  stripe: "from-green-400 to-emerald-300"             },
};

const SOURCE_CONFIG = {
  mural:  { label: "Mural",  icon: "brush",     color: "text-orange-500", bg: "bg-orange-50 border-orange-100" },
  manual: { label: "Manual", icon: "edit_note", color: "text-blue-500",   bg: "bg-blue-50 border-blue-100"    },
};

const STEP_LABEL = {
  workshop: "Workshop", validation: "Validation", opportunity: "Validation",
  shaping: "Shaping", artifacts: "Artifacts", stories: "Stories", jira: "Jira Export",
};

const STEP_VIEW_MAP = {
  workshop: "workshop", validation: "opportunity", opportunity: "opportunity",
  shaping: "shaping", artifacts: "artifacts", stories: "stories", jira: "jira",
};

const FEATURE_RESULT_CACHE_KEY   = "feature_generator_result_v1";
const FEATURE_RESULT_RESTORE_KEY = "feature_generator_restore_pending";
const FEATURE_OPEN_ID_KEY        = "feature_generator_open_id";
const STORY_SOURCE_FEATURE_KEY   = "story_generator_source_feature_id";

const FEATURE_STATUS = {
  generated: { label: "Generated", badge: "bg-violet-50 text-violet-600 border-violet-100" },
  exported:  { label: "Exported",  badge: "bg-green-50 text-green-600 border-green-100"   },
  draft:     { label: "Draft",     badge: "bg-slate-100 text-slate-500 border-slate-200"  },
};

const SOURCE_TYPE_LABEL = {
  prompt:      "Problem Statement",
  opportunity: "Opportunity",
  requirement: "Requirement",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-surface border border-outline rounded-xl overflow-hidden animate-pulse">
      <div className="h-[3px] bg-surface-container" />
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-container shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-36 bg-surface-container rounded" />
            <div className="h-2.5 w-20 bg-surface-container rounded" />
          </div>
          <div className="h-5 w-14 bg-surface-container rounded-full" />
        </div>
        <div className="flex gap-2">
          <div className="h-5 w-16 bg-surface-container rounded-full" />
          <div className="h-5 w-24 bg-surface-container rounded-full" />
        </div>
        <div className="h-px bg-surface-container" />
        <div className="flex justify-end">
          <div className="h-7 w-20 bg-surface-container rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─── Workshop card ────────────────────────────────────────────────────────────
function WorkshopCard({ workshop, onOpen }) {
  const statusCfg = WORKSHOP_STATUS[workshop.status] ?? WORKSHOP_STATUS.draft;
  const source    = workshop.import_meta?.source;
  const sourceCfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.manual;
  const hasRun    = Boolean(workshop.current_workflow_id);
  const isCompleted = workshop.status === "completed";
  const step      = STEP_LABEL[workshop.latest_workflow_step];
  const updated   = relativeTime(workshop.updated_at);

  return (
    <div
      className="bg-surface border border-outline rounded-xl overflow-hidden shadow-card hover:shadow-md hover:border-primary/30 transition-all flex flex-col cursor-pointer group"
      onClick={() => onOpen(workshop)}
    >
      <div className={`h-[3px] shrink-0 bg-gradient-to-r ${statusCfg.stripe}`} />

      <div className="p-5 flex flex-col gap-3 flex-1">

        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-[18px] text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                groups
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-headline font-bold text-on-surface leading-snug truncate">
                {workshop.title || "Untitled Workshop"}
              </p>
              {updated && (
                <p className="text-[11px] text-on-surface-variant mt-0.5">{updated}</p>
              )}
            </div>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${statusCfg.badge}`}>
            {statusCfg.label}
          </span>
        </div>

        {/* Meta chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sourceCfg.bg}`}>
            <span className={`material-symbols-outlined text-[11px] ${sourceCfg.color}`}>{sourceCfg.icon}</span>
            <span className={sourceCfg.color}>{sourceCfg.label}</span>
          </span>
          {step && (
            <span className="flex items-center gap-1 text-[10px] text-on-surface-variant bg-surface-container border border-outline px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[11px]">arrow_forward</span>
              {step}
            </span>
          )}
          {(workshop.workflow_count ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-on-surface-variant">
              <span className="material-symbols-outlined text-[11px]">account_tree</span>
              {workshop.workflow_count} {workshop.workflow_count === 1 ? "run" : "runs"}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-outline mt-auto">
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(workshop); }}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all shadow-sm",
              hasRun
                ? "bg-primary text-white hover:bg-primary-dim"
                : "bg-surface-container text-on-surface border border-outline hover:border-primary hover:text-primary",
            ].join(" ")}
          >
            <span className="material-symbols-outlined text-[13px]">
              {hasRun ? (isCompleted ? "visibility" : "play_arrow") : "add"}
            </span>
            {hasRun ? (isCompleted ? "View" : "Resume") : "Start Run"}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Workshops tab ────────────────────────────────────────────────────────────
function WorkshopsTab({ project, onNavigate, onNewWorkshop }) {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => { load(); }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkshops(project.id);
      setWorkshops(Array.isArray(data) ? data : (data.workshops ?? []));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen(workshop) {
    if (workshop.current_workflow_id) {
      try {
        const wf = await getWorkflow(workshop.current_workflow_id);
        restoreWorkflowState(wf);
        const step = STEP_VIEW_MAP[wf.current_step] ?? "workshop";
        onNavigate?.(step, project);
        return;
      } catch { /* fall through */ }
    }

    // No run yet — fetch full workshop record and pre-populate session
    // so WorkshopIntelligence hydrates with the saved content
    clearWorkflowState();
    storeCurrentWorkshopId(workshop.id);
    try {
      const fullWs = await getWorkshop(workshop.id);
      sessionStorage.setItem("workshop_pipeline_data", JSON.stringify({
        title:    fullWs.title ?? "",
        insights: fullWs.insights_payload ?? null,
        journey:  fullWs.journey_payload  ?? null,
      }));
      if (fullWs.title || fullWs.insights_payload) {
        sessionStorage.setItem("workflow_restore_pending", "true");
        sessionStorage.setItem("workflow_restore_step", "workshop");
      }
    } catch {
      // Fallback to card-level title if fetch fails
      if (workshop.title) {
        sessionStorage.setItem("workshop_pipeline_data", JSON.stringify({ title: workshop.title, insights: null, journey: null }));
        sessionStorage.setItem("workflow_restore_pending", "true");
        sessionStorage.setItem("workflow_restore_step", "workshop");
      }
    }
    onNavigate?.("workshop", project);
  }

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );

  if (error) return (
    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
      <span className="material-symbols-outlined text-error text-[16px]">error</span>
      <p className="text-sm text-red-700 flex-1">{error}</p>
      <button onClick={load} className="text-xs font-semibold text-red-600 hover:text-red-700">Retry</button>
    </div>
  );

  if (workshops.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 border-2 border-dashed border-outline rounded-2xl">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <span
          className="material-symbols-outlined text-[26px] text-primary"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          groups
        </span>
      </div>
      <div className="text-center max-w-xs">
        <p className="text-sm font-semibold text-on-surface mb-1">No workshops yet</p>
        <p className="text-[12px] text-on-surface-variant leading-relaxed">
          Run a discovery session to extract insights and define features for this project.
        </p>
      </div>
      <button
        onClick={onNewWorkshop}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dim transition-all shadow-sm"
      >
        <span className="material-symbols-outlined text-[16px]">add</span>
        New Workshop
      </button>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-on-surface-variant">
          {workshops.length} {workshops.length === 1 ? "workshop" : "workshops"} for this project.
        </p>
        <button
          onClick={onNewWorkshop}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dim transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Workshop
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {workshops.map((ws) => (
          <WorkshopCard key={ws.id} workshop={ws} onOpen={handleOpen} />
        ))}
      </div>
    </div>
  );
}

// ─── Stat tile (overview grid — clickable, navigates to relevant tab) ────────
function StatCard({ icon, value, label, iconColor, iconBg, stripe, tab, onTabChange }) {
  const Tag = tab ? "button" : "div";
  return (
    <Tag
      onClick={tab ? () => onTabChange?.(tab) : undefined}
      className={[
        "bg-surface border border-outline rounded-2xl overflow-hidden shadow-card text-left w-full",
        tab ? "hover:shadow-md hover:-translate-y-0.5 hover:border-primary/20 transition-all group cursor-pointer" : "",
      ].join(" ")}
    >
      <div className={`h-[3px] bg-gradient-to-r ${stripe ?? "from-outline to-outline"}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${iconBg}`}>
            <span
              className={`material-symbols-outlined text-[18px] ${iconColor}`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {icon}
            </span>
          </div>
          {tab && (
            <span className="material-symbols-outlined text-[14px] text-transparent group-hover:text-on-surface-variant/40 transition-colors mt-0.5">
              arrow_forward
            </span>
          )}
        </div>
        <p className="text-[32px] font-headline font-black text-on-surface leading-none tracking-tight">{value}</p>
        <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mt-2">{label}</p>
      </div>
    </Tag>
  );
}

// ─── Placeholder tab panel ────────────────────────────────────────────────────
function PlaceholderTab({ icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center">
        <span
          className="material-symbols-outlined text-[28px] text-on-surface-variant"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>
      <div className="text-center max-w-xs">
        <p className="text-sm font-semibold text-on-surface mb-1">{title}</p>
        <p className="text-[12px] text-on-surface-variant leading-relaxed">{sub}</p>
      </div>
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab({ project, onNewWorkshop, featureCount, storyCount, onTabChange, onNavigate }) {
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      getWorkshops(project.id),
      getProjectFeatures(project.id),
    ]).then(([wsRes, featRes]) => {
      if (cancelled) return;
      const workshops = wsRes.status === "fulfilled"
        ? (Array.isArray(wsRes.value) ? wsRes.value : (wsRes.value?.workshops ?? []))
            .map((w) => ({ id: w.id, title: w.title || "Untitled Workshop", subtitle: `Workshop · ${relativeTime(w.updated_at) ?? "recently"}`, icon: "groups" }))
        : [];
      const features = featRes.status === "fulfilled"
        ? (Array.isArray(featRes.value) ? featRes.value : (featRes.value?.features ?? []))
            .map((f) => ({ id: `f-${f.id ?? f.feature_id}`, title: f.title || "Untitled Feature", subtitle: `Feature · ${relativeTime(f.updated_at) ?? "recently"}`, icon: "auto_awesome" }))
        : [];
      if (!cancelled) setRecentActivity([...workshops, ...features].slice(0, 4));
    });
    return () => { cancelled = true; };
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRunFeatureGenerator() {
    try {
      sessionStorage.removeItem(FEATURE_RESULT_CACHE_KEY);
      sessionStorage.removeItem(FEATURE_RESULT_RESTORE_KEY);
      sessionStorage.removeItem(FEATURE_OPEN_ID_KEY);
    } catch {}
    onNavigate?.("feature-generator", project);
  }

  const statTiles = [
    { icon: "groups",       value: project.workshop_count        ?? 0, label: "Workshops",        tab: "workshops" },
    { icon: "schema",       value: project.active_workflow_count ?? 0, label: "Active Workflows", tab: "workflows" },
    { icon: "category",     value: featureCount,                        label: "Features",         tab: "features"  },
    { icon: "auto_stories", value: storyCount,                          label: "Stories",          tab: "backlog"   },
  ];

  return (
    <div className="grid grid-cols-12 gap-8">

      {/* ── Left column (8/12) ── */}
      <div className="col-span-12 lg:col-span-8 space-y-8">

        {/* Stat bento grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statTiles.map((s) => (
            <button
              key={s.label}
              onClick={() => onTabChange?.(s.tab)}
              className="bg-white p-6 rounded-xl border border-slate-200/60 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">{s.label}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-extrabold text-on-surface font-headline">{s.value}</h3>
                <span className="material-symbols-outlined text-primary/25 text-3xl group-hover:text-primary/50 transition-colors">{s.icon}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Project banner */}
        <div
          className={`relative overflow-hidden rounded-2xl flex items-center bg-slate-900`}
          style={{ aspectRatio: "21/9" }}
        >
          {/* Status-tinted gradient — unique to each project's state */}
          <div className={`absolute inset-0 bg-gradient-to-br ${STATUS_CONFIG[project.status]?.stripe ?? STATUS_CONFIG.active.stripe} opacity-30`} />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-800/60" />
          {/* Subtle dot-grid texture */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          />
          <div className="relative z-10 p-10 max-w-lg">
            <h3 className="text-2xl font-extrabold text-white mb-3 font-headline">{project.name}</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              {project.description ||
                `This project has ${featureCount} feature${featureCount !== 1 ? "s" : ""} and ${storyCount} ${storyCount === 1 ? "story" : "stories"} in progress. Run the Feature Generator or start a Workshop to continue building.`}
            </p>
            <button
              onClick={() => onTabChange?.("features")}
              className="mt-6 text-blue-300 font-bold text-sm flex items-center gap-2 hover:gap-3 transition-all"
            >
              View Features
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Recent activity */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-bold text-on-surface font-headline">Recent Activity</h4>
            <button
              onClick={() => onTabChange?.("workshops")}
              className="text-xs font-bold text-primary uppercase tracking-widest hover:text-primary-dim transition-colors"
            >
              View All
            </button>
          </div>
          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="bg-surface-container p-4 rounded-xl flex items-center justify-between hover:bg-surface-dim transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-primary shadow-sm shrink-0">
                      <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{item.title}</p>
                      <p className="text-[10px] text-on-surface-variant">{item.subtitle}</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant/30">more_vert</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface-container p-4 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant/30">history</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">No activity yet</p>
                <p className="text-[10px] text-on-surface-variant">Start a workshop or generate a feature to see activity here.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Right sidebar (4/12) ── */}
      <aside className="col-span-12 lg:col-span-4 space-y-6">

        {/* Project Metadata */}
        <div className="bg-surface-container rounded-2xl p-8">
          <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-6">Project Metadata</h4>
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase">Status</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${project.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                <span className="text-sm font-extrabold text-on-surface uppercase tracking-wide">
                  {STATUS_CONFIG[project.status]?.label ?? "Active"}
                </span>
              </div>
            </div>
            {project.slug && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase">Project Slug</span>
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-dim rounded-lg">
                  <span className="text-sm font-mono text-primary flex-1 truncate">{project.slug}</span>
                </div>
              </div>
            )}
            {project.description && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase">Description</span>
                <p className="text-sm text-on-surface leading-relaxed line-clamp-3">{project.description}</p>
              </div>
            )}
            {project.created_at && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase">Date Created</span>
                <span className="text-sm font-semibold text-on-surface">
                  {new Date(project.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Generate Feature CTA */}
        <div className="bg-gradient-to-br from-primary to-blue-600 rounded-2xl p-8 text-white">
          <span
            className="material-symbols-outlined text-4xl mb-4 block opacity-50"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome_motion
          </span>
          <h4 className="text-xl font-extrabold mb-2 font-headline">Generate a Feature</h4>
          <p className="text-xs text-blue-100 leading-relaxed mb-6 opacity-80">
            Turn a problem statement or opportunity into a PM-ready feature spec in seconds.
          </p>
          <button
            onClick={handleRunFeatureGenerator}
            className="w-full py-3 bg-white text-primary text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
          >
            <span
              className="material-symbols-outlined text-base"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            Run Feature Generator
          </button>
        </div>

      </aside>
    </div>
  );
}

// ─── Feature card ────────────────────────────────────────────────────────────
function FeatureCard({ feature, onOpen, onGenerateStories }) {
  const statusCfg = FEATURE_STATUS[feature.status] ?? FEATURE_STATUS.generated;
  const sourceLabel = SOURCE_TYPE_LABEL[feature.source_type] ?? feature.source_type ?? "—";
  const updated = relativeTime(feature.updated_at);
  const isExported = feature.status === "exported";

  return (
    <div
      className="bg-surface border border-outline rounded-xl overflow-hidden shadow-card hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all flex flex-col cursor-pointer group"
      onClick={() => onOpen(feature)}
    >
      <div className="h-[3px] shrink-0 bg-gradient-to-r from-violet-400 via-violet-300 to-primary" />

      <div className="p-5 flex flex-col gap-3 flex-1">

        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-[18px] text-violet-500"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-headline font-bold text-on-surface leading-snug line-clamp-2">
                {feature.title || "Untitled Feature"}
              </p>
              {updated && (
                <p className="text-[11px] text-on-surface-variant mt-0.5">{updated}</p>
              )}
            </div>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${statusCfg.badge}`}>
            {statusCfg.label}
          </span>
        </div>

        {/* Summary */}
        {feature.summary && (
          <p className="text-[12px] text-on-surface-variant leading-relaxed line-clamp-2">{feature.summary}</p>
        )}

        {/* Meta chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-violet-50 border-violet-100 text-violet-600">
            <span className="material-symbols-outlined text-[11px]">category</span>
            {sourceLabel}
          </span>
          {feature.skill_name && (
            <span className="flex items-center gap-1 text-[10px] text-on-surface-variant bg-surface-container border border-outline px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[11px]">psychology</span>
              {feature.skill_name}
            </span>
          )}
        </div>

        {/* Jira key if exported */}
        {isExported && feature.jira_issue_key && (
          <a
            href={feature.jira_issue_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0052CC]/5 border border-[#0052CC]/20 rounded-lg w-fit hover:bg-[#0052CC]/10 transition-colors"
          >
            <span className="text-[10px] font-bold text-[#0052CC]">{feature.jira_issue_key}</span>
            {feature.jira_issue_type && (
              <span className="text-[10px] text-on-surface-variant">· {feature.jira_issue_type}</span>
            )}
            <span className="material-symbols-outlined text-[11px] text-[#0052CC]">open_in_new</span>
          </a>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline mt-auto">
          <button
            onClick={(e) => { e.stopPropagation(); onGenerateStories(feature); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-all"
          >
            <span className="material-symbols-outlined text-[13px]">receipt_long</span>
            Stories
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(feature); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-primary text-white hover:bg-primary-dim transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[13px]">open_in_full</span>
            Open
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Features tab ─────────────────────────────────────────────────────────────
function FeaturesTab({ project, onNavigate, onCountUpdate }) {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => { load(); }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectFeatures(project.id);
      const rows = Array.isArray(data) ? data : (data.features ?? []);
      setFeatures(rows);
      onCountUpdate?.(rows.length);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenFeature(feature) {
    const id = feature.id ?? feature.feature_id;
    try {
      sessionStorage.setItem(FEATURE_OPEN_ID_KEY, id);
      sessionStorage.removeItem(FEATURE_RESULT_CACHE_KEY);
      sessionStorage.removeItem(FEATURE_RESULT_RESTORE_KEY);
    } catch {}
    onNavigate?.("feature-generator", project);
  }

  function handleGenerateStories(feature) {
    const id = feature.id ?? feature.feature_id;
    try { sessionStorage.setItem(STORY_SOURCE_FEATURE_KEY, id); } catch {}
    onNavigate?.("story-generator", project);
  }

  function handleRunAgent() {
    try {
      sessionStorage.removeItem(FEATURE_RESULT_CACHE_KEY);
      sessionStorage.removeItem(FEATURE_RESULT_RESTORE_KEY);
      sessionStorage.removeItem(FEATURE_OPEN_ID_KEY);
    } catch {}
    onNavigate?.("feature-generator", project);
  }

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );

  if (error) return (
    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
      <span className="material-symbols-outlined text-error text-[16px]">error</span>
      <p className="text-sm text-red-700 flex-1">{error}</p>
      <button onClick={load} className="text-xs font-semibold text-red-600 hover:text-red-700">Retry</button>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-on-surface-variant">
          {features.length > 0
            ? `${features.length} generated feature${features.length === 1 ? "" : "s"} for this project.`
            : "Features generated by the Feature Generator agent appear here."}
        </p>
        <button
          onClick={handleRunAgent}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-violet-700 text-white text-sm font-bold rounded-xl hover:from-violet-500 hover:to-violet-600 transition-all shadow-sm shadow-violet-500/20 active:scale-[0.98]"
        >
          <span
            className="material-symbols-outlined text-[16px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
          Generate Feature
        </button>
      </div>

      {features.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 border-2 border-dashed border-outline rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-[26px] text-violet-400"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
          </div>
          <div className="text-center max-w-xs">
            <p className="text-sm font-semibold text-on-surface mb-1">No features yet</p>
            <p className="text-[12px] text-on-surface-variant leading-relaxed">
              Run the Feature Generator agent to create your first PM-ready feature draft.
            </p>
          </div>
          <button
            onClick={handleRunAgent}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-violet-700 text-white text-sm font-bold rounded-xl hover:from-violet-500 hover:to-violet-600 transition-all shadow-sm shadow-violet-500/20"
          >
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            Generate First Feature
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <FeatureCard key={f.id ?? f.feature_id} feature={f} onOpen={handleOpenFeature} onGenerateStories={handleGenerateStories} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stories tab (Backlog) ────────────────────────────────────────────────────
const STORY_PRIORITY_CFG = {
  high:   "bg-red-50 text-red-600 border-red-100",
  medium: "bg-amber-50 text-amber-600 border-amber-100",
  low:    "bg-slate-100 text-slate-500 border-slate-200",
};

function StoriesTab({ project, onNavigate, onCountUpdate }) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => { load(); }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectStories(project.id);
      const rows = Array.isArray(data) ? data : (data.stories ?? []);
      setStories(rows);
      onCountUpdate?.(rows.length);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleRunAgent() {
    onNavigate?.("story-generator", project);
  }

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );

  if (error) return (
    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
      <span className="material-symbols-outlined text-error text-[16px]">error</span>
      <p className="text-sm text-red-700 flex-1">{error}</p>
      <button onClick={load} className="text-xs font-semibold text-red-600 hover:text-red-700">Retry</button>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-on-surface-variant">
          {stories.length > 0
            ? `${stories.length} ${stories.length === 1 ? "story" : "stories"} for this project.`
            : "Stories generated by the Story Generator agent appear here."}
        </p>
        <button
          onClick={handleRunAgent}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-bold rounded-xl hover:from-emerald-500 hover:to-emerald-600 transition-all shadow-sm shadow-emerald-500/20 active:scale-[0.98]"
        >
          <span
            className="material-symbols-outlined text-[16px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            receipt_long
          </span>
          Generate Stories
        </button>
      </div>

      {stories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 border-2 border-dashed border-outline rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-[26px] text-emerald-400"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              receipt_long
            </span>
          </div>
          <div className="text-center max-w-xs">
            <p className="text-sm font-semibold text-on-surface mb-1">No stories yet</p>
            <p className="text-[12px] text-on-surface-variant leading-relaxed">
              Run the Story Generator agent to break a feature into user stories.
            </p>
          </div>
          <button
            onClick={handleRunAgent}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-bold rounded-xl hover:from-emerald-500 hover:to-emerald-600 transition-all shadow-sm shadow-emerald-500/20"
          >
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
            Generate First Stories
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {stories.map((story, i) => {
            const id = story.id ?? story.story_id ?? i;
            const priorityCls = STORY_PRIORITY_CFG[story.priority ?? "medium"] ?? STORY_PRIORITY_CFG.medium;
            const updated = relativeTime(story.updated_at ?? story.created_at);
            return (
              <div key={id} className="bg-surface border border-outline rounded-xl overflow-hidden shadow-card flex flex-col">
                <div className="flex items-center gap-3 px-5 py-3.5 bg-emerald-50 border-b border-emerald-100">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-white leading-none">{i + 1}</span>
                  </div>
                  <h4 className="text-sm font-headline font-bold text-on-surface flex-1 leading-snug">{story.title}</h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${priorityCls}`}>
                    {story.priority ?? "medium"}
                  </span>
                </div>
                <div className="p-4 space-y-3 flex-1">
                  {(story.as_a || story.i_want || story.so_that) ? (
                    <div className="bg-surface-container border border-outline rounded-xl px-4 py-3 space-y-1">
                      <p className="text-[12px] text-on-surface-variant leading-relaxed">
                        <span className="font-semibold text-on-surface">As a</span> {story.as_a}
                      </p>
                      <p className="text-[12px] text-on-surface-variant leading-relaxed">
                        <span className="font-semibold text-on-surface">I want</span> {story.i_want}
                      </p>
                      <p className="text-[12px] text-on-surface-variant leading-relaxed">
                        <span className="font-semibold text-on-surface">So that</span> {story.so_that}
                      </p>
                    </div>
                  ) : story.user_story ? (
                    <p className="text-[12px] text-on-surface-variant italic leading-relaxed">{story.user_story}</p>
                  ) : null}
                  {story.acceptance_criteria?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                        Acceptance Criteria
                      </p>
                      <ul className="space-y-1">
                        {story.acceptance_criteria.slice(0, 3).map((crit, ci) => (
                          <li key={ci} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                            <span
                              className="material-symbols-outlined text-[12px] text-emerald-500 mt-0.5 shrink-0"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              check_circle
                            </span>
                            {crit}
                          </li>
                        ))}
                        {story.acceptance_criteria.length > 3 && (
                          <li className="text-[11px] text-on-surface-variant pl-5">
                            +{story.acceptance_criteria.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                  {updated && (
                    <p className="text-[11px] text-on-surface-variant">{updated}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Agents tab ───────────────────────────────────────────────────────────────
const AGENT_CATALOG = [
  {
    id:          "feature-generator",
    icon:        "auto_awesome",
    name:        "Feature Generator",
    description: "Generate a PM-ready feature draft from a problem statement, user research, or requirement context.",
    color:       "text-violet-500",
    bg:          "bg-violet-50 border-violet-100",
    stripe:      "from-violet-400 via-violet-300 to-primary",
    skillType:   "feature_spec",
  },
  {
    id:          "story-generator",
    icon:        "receipt_long",
    name:        "Story Generator",
    description: "Break a persisted feature into PM-ready user stories using the active Story Spec Skill.",
    color:       "text-emerald-600",
    bg:          "bg-emerald-50 border-emerald-100",
    stripe:      "from-emerald-400 via-emerald-300 to-green-300",
    skillType:   "story_spec",
  },
];

function AgentsTab({ project, onNavigate }) {
  const [agentSkills, setAgentSkills] = useState({});

  function handleRunAgent(agentId) {
    if (agentId === "feature-generator") {
      try {
        sessionStorage.removeItem(FEATURE_RESULT_CACHE_KEY);
        sessionStorage.removeItem(FEATURE_RESULT_RESTORE_KEY);
      } catch {}
    }
    onNavigate?.(agentId, project);
  }

  useEffect(() => {
    let cancelled = false;
    const skillTypes = [...new Set(AGENT_CATALOG.map((a) => a.skillType).filter(Boolean))];
    Promise.allSettled(
      skillTypes.map((type) =>
        getSkills(type, true).then((result) => {
          const rows = Array.isArray(result) ? result : (result.skills ?? []);
          return [type, rows[0] ?? null];
        })
      )
    ).then((results) => {
      if (cancelled) return;
      const map = {};
      results.forEach((r) => {
        if (r.status === "fulfilled" && r.value) {
          const [type, skill] = r.value;
          if (skill) map[type] = skill;
        }
      });
      setAgentSkills(map);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <p className="text-sm text-on-surface-variant mb-6">
        Reusable AI agents that run independently within this project's context.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENT_CATALOG.map((agent) => {
          const skill = agent.skillType ? agentSkills[agent.skillType] : null;
          return (
            <div
              key={agent.id}
              className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-card hover:shadow-md hover:-translate-y-0.5 hover:border-primary/25 transition-all duration-200 flex flex-col cursor-pointer group"
              onClick={() => handleRunAgent(agent.id)}
            >
              <div className={`h-[5px] bg-gradient-to-r ${agent.stripe}`} />
              <div className="p-6 flex flex-col gap-4 flex-1">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 shadow-sm ${agent.bg}`}>
                  <span
                    className={`material-symbols-outlined text-[22px] ${agent.color}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {agent.icon}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-headline font-bold text-on-surface">{agent.name}</p>
                  <p className="text-[12px] text-on-surface-variant mt-1.5 leading-relaxed">{agent.description}</p>
                  {skill && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="material-symbols-outlined text-[12px] text-on-surface-variant">psychology</span>
                      <p className="text-[11px] text-on-surface-variant">
                        Uses <span className="font-semibold text-on-surface">{skill.name}</span>
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRunAgent(agent.id); }}
                  className={[
                    "flex items-center gap-2 px-4 py-2 text-white text-sm font-bold rounded-xl transition-all shadow-sm w-fit",
                    agent.id === "story-generator"
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-emerald-500/20"
                      : "bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 shadow-violet-500/20",
                  ].join(" ")}
                >
                  <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                  Run Agent
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function ProjectDetail({ project, onNavigate }) {

  const [activeTab, setActiveTab]               = useState("overview");
  const [featureCountOverride, setFeatureCountOverride] = useState(null);
  const [storyCountOverride,   setStoryCountOverride]   = useState(null);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center">
          <span className="material-symbols-outlined text-[28px] text-on-surface-variant">folder_off</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-on-surface mb-1">Project not found</p>
          <p className="text-[12px] text-on-surface-variant">
            This project may have been removed or you may have followed an invalid link.
          </p>
        </div>
        <button
          onClick={() => onNavigate?.("projects")}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dim transition-all shadow-sm"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active;

  async function handleNewWorkshop() {
    clearWorkflowState();
    try {
      const ws = await createWorkshop({
        title:      "Untitled Workshop",
        project_id: project.id,
      });
      storeCurrentWorkshopId(ws.id);
    } catch (e) {
      console.warn("[workshop] pre-create failed:", e);
    }
    onNavigate?.("workshop", project);
  }

  const effectiveFeatureCount = featureCountOverride ?? project.feature_count ?? 0;
  const effectiveStoryCount   = storyCountOverride   ?? project.story_count   ?? 0;

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Header area ── */}
      <div className="border-b border-slate-200/50 bg-white">
        <div className="px-10 pt-8 pb-0">

          {/* Breadcrumb */}
          <div className="flex items-center gap-3 mb-5">
            <span className="bg-secondary-container text-on-secondary text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest">
              {cfg.label} Project
            </span>
            <div className="flex items-center gap-1.5 text-on-surface-variant text-sm">
              <button
                onClick={() => onNavigate?.("projects")}
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-base">folder</span>
                <span>Projects</span>
              </button>
              <span className="material-symbols-outlined text-base">chevron_right</span>
              <span className="font-semibold text-on-surface">{project.name}</span>
            </div>
          </div>

          {/* Title + action buttons */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <h1 className="text-4xl font-extrabold tracking-tight text-on-surface font-headline">
              {project.name}
            </h1>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleNewWorkshop}
                className="px-5 py-2.5 bg-surface-container text-on-surface font-semibold text-sm rounded-lg flex items-center gap-2 hover:bg-surface-dim transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                Start a Workshop
              </button>
              <button
                onClick={() => {
                  try {
                    sessionStorage.removeItem(FEATURE_RESULT_CACHE_KEY);
                    sessionStorage.removeItem(FEATURE_RESULT_RESTORE_KEY);
                    sessionStorage.removeItem(FEATURE_OPEN_ID_KEY);
                  } catch {}
                  onNavigate?.("feature-generator", project);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-primary to-blue-500 text-white font-bold text-sm rounded-lg flex items-center gap-2 shadow-sm shadow-primary/20 hover:opacity-90 transition-opacity"
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  auto_awesome
                </span>
                Generate a Feature
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-8">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "pb-4 text-sm transition-colors border-b-2 -mb-px",
                    isActive
                      ? "font-bold text-primary border-primary"
                      : "font-medium text-on-surface-variant border-transparent hover:text-on-surface",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-10 py-8 flex-1 bg-slate-50/60">

        {activeTab === "overview" && (
          <OverviewTab
            project={project}
            onNewWorkshop={handleNewWorkshop}
            featureCount={effectiveFeatureCount}
            storyCount={effectiveStoryCount}
            onTabChange={setActiveTab}
            onNavigate={onNavigate}
          />
        )}

        {activeTab === "workshops" && (
          <WorkshopsTab project={project} onNavigate={onNavigate} onNewWorkshop={handleNewWorkshop} />
        )}

        {activeTab === "workflows" && (
          <WorkflowList
            onNavigate={onNavigate}
            projectId={project.id}
            embedded={true}
            onNewWorkshop={handleNewWorkshop}
          />
        )}

        {activeTab === "agents" && (
          <AgentsTab project={project} onNavigate={onNavigate} />
        )}

        {activeTab === "features" && (
          <FeaturesTab project={project} onNavigate={onNavigate} onCountUpdate={setFeatureCountOverride} />
        )}

        {activeTab === "backlog" && (
          <StoriesTab project={project} onNavigate={onNavigate} onCountUpdate={setStoryCountOverride} />
        )}

        {activeTab === "roadmap" && (
          <PlaceholderTab
            icon="map"
            title="Roadmap coming soon"
            sub="The roadmap will be built from this project's features and initiatives."
          />
        )}

      </div>

    </div>
  );
}
