import { useState, useEffect } from "react";
import WorkflowList from "./WorkflowList";
import { createWorkshop, getWorkshop, getWorkshops } from "../api/workshops";
import {
  getWorkflow, restoreWorkflowState, clearWorkflowState,
  storeCurrentWorkshopId,
} from "../api/workflows";

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",  label: "Overview",  icon: "grid_view"    },
  { id: "workshops", label: "Workshops", icon: "groups"       },
  { id: "workflows", label: "Workflows", icon: "account_tree" },
  { id: "backlog",   label: "Backlog",   icon: "assignment"   },
  { id: "roadmap",   label: "Roadmap",   icon: "map"          },
];

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  active:    { label: "Active",    badge: "bg-blue-50 text-blue-600 border-blue-100",     stripe: "from-primary via-blue-400 to-blue-300"    },
  on_hold:   { label: "On Hold",   badge: "bg-amber-50 text-amber-600 border-amber-100",  stripe: "from-amber-400 via-amber-300 to-amber-200" },
  completed: { label: "Completed", badge: "bg-green-50 text-green-600 border-green-100",  stripe: "from-green-400 to-emerald-300"             },
  archived:  { label: "Archived",  badge: "bg-slate-100 text-slate-500 border-slate-200", stripe: "from-slate-300 to-slate-200"               },
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
            <span className="material-symbols-outlined text-[13px]">{hasRun ? "play_arrow" : "add"}</span>
            {hasRun ? "Resume" : "Start Run"}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Workshops tab ────────────────────────────────────────────────────────────
function WorkshopsTab({ project, onNavigate }) {
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
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center">
        <span
          className="material-symbols-outlined text-[24px] text-on-surface-variant"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          groups
        </span>
      </div>
      <p className="text-sm font-semibold text-on-surface">No workshops yet</p>
      <p className="text-[12px] text-on-surface-variant">
        Start a workshop from the Overview tab to begin discovery.
      </p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {workshops.map((ws) => (
        <WorkshopCard key={ws.id} workshop={ws} onOpen={handleOpen} />
      ))}
    </div>
  );
}

// ─── Stat card (overview grid) ────────────────────────────────────────────────
function StatCard({ icon, value, label, iconColor, iconBg }) {
  return (
    <div className="bg-surface border border-outline rounded-xl p-6 shadow-card flex flex-col items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${iconBg}`}>
        <span
          className={`material-symbols-outlined text-[20px] ${iconColor}`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>
      <div>
        <p className="text-3xl font-headline font-bold text-on-surface leading-none">{value}</p>
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mt-1.5">{label}</p>
      </div>
    </div>
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
function OverviewTab({ project, onNewWorkshop }) {
  const hasWorkshops = (project.workshop_count ?? 0) > 0;

  const statCards = [
    { icon: "groups",        value: project.workshop_count        ?? 0, label: "Workshops",        iconColor: "text-primary",    iconBg: "bg-primary/10 border-primary/20"   },
    { icon: "account_tree",  value: project.active_workflow_count ?? 0, label: "Active Workflows",  iconColor: "text-blue-500",   iconBg: "bg-blue-50 border-blue-100"        },
    { icon: "auto_awesome",  value: project.feature_count        ?? 0, label: "Features",          iconColor: "text-violet-500", iconBg: "bg-violet-50 border-violet-100"    },
    { icon: "receipt_long",  value: project.story_count          ?? 0, label: "Stories",           iconColor: "text-emerald-600",iconBg: "bg-emerald-50 border-emerald-100"  },
  ];

  return (
    <div className="flex flex-col gap-8">

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className={[
        "bg-surface border rounded-xl p-8 shadow-card flex flex-col sm:flex-row items-start sm:items-center gap-6",
        hasWorkshops ? "border-outline" : "border-primary/30 bg-blue-50/20",
      ].join(" ")}>
        <div className={[
          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
          hasWorkshops ? "bg-primary/10 border-primary/20" : "bg-primary border-primary",
        ].join(" ")}>
          <span
            className={`material-symbols-outlined text-[22px] ${hasWorkshops ? "text-primary" : "text-white"}`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            groups
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-headline font-bold text-on-surface">
            {hasWorkshops ? "Start Another Workshop" : "Start Your First Workshop"}
          </p>
          <p className="text-[12px] text-on-surface-variant mt-1 leading-relaxed">
            {hasWorkshops
              ? "Begin a new discovery workshop session for this project."
              : "Begin a new discovery workshop to extract insights and define features for this project."}
          </p>
        </div>
        <button
          onClick={onNewWorkshop}
          className={[
            "flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-all shadow-sm shrink-0 active:scale-95",
            hasWorkshops
              ? "bg-surface border border-outline text-on-surface hover:border-primary hover:text-primary"
              : "bg-primary text-white hover:bg-primary-dim",
          ].join(" ")}
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Workshop
        </button>
      </div>

    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function ProjectDetail({ project, onNavigate }) {

  const [activeTab, setActiveTab] = useState("overview");

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

  const headerStats = [
    { icon: "groups",       value: project.workshop_count        ?? 0, label: "Workshops"        },
    { icon: "account_tree", value: project.active_workflow_count ?? 0, label: "Active Workflows" },
    { icon: "auto_awesome", value: project.feature_count        ?? 0, label: "Features"         },
    { icon: "receipt_long", value: project.story_count          ?? 0, label: "Stories"          },
  ];

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Header area ── */}
      <div className="border-b border-outline">

        <div className={`h-[3px] bg-gradient-to-r ${cfg.stripe}`} />

        <div className="px-10 py-8">

          {/* Breadcrumb */}
          <button
            onClick={() => onNavigate?.("projects")}
            className="flex items-center gap-1 text-[12px] font-semibold text-on-surface-variant hover:text-primary transition-colors mb-5"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            Projects
          </button>

          {/* Title + badge */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-headline font-bold text-on-surface tracking-tight">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-sm text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 mt-1 ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>

          {/* Stat chips */}
          <div className="flex items-center gap-5 mt-5 flex-wrap">
            {headerStats.map(({ icon, value, label }, i) => (
              <div key={label} className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
                <span className="material-symbols-outlined text-[14px]">{icon}</span>
                <span className="font-bold text-on-surface">{value}</span>
                <span>{label}</span>
                {i < headerStats.length - 1 && (
                  <span className="ml-3 text-outline select-none">·</span>
                )}
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div className="flex items-end gap-0 mt-7 -mb-px">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px",
                    isActive
                      ? "text-primary font-bold border-primary"
                      : "text-on-surface-variant border-transparent hover:text-on-surface",
                  ].join(" ")}
                >
                  <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-10 py-6 flex-1">

        {activeTab === "overview" && (
          <OverviewTab project={project} onNewWorkshop={handleNewWorkshop} />
        )}

        {activeTab === "workshops" && (
          <WorkshopsTab project={project} onNavigate={onNavigate} />
        )}

        {activeTab === "workflows" && (
          <WorkflowList
            onNavigate={onNavigate}
            projectId={project.id}
            embedded={true}
            onNewWorkshop={handleNewWorkshop}
          />
        )}

        {activeTab === "backlog" && (
          <PlaceholderTab
            icon="assignment"
            title="Backlog coming soon"
            sub="The backlog will sync automatically from Jira once the integration is configured."
          />
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
