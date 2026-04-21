import { useEffect, useMemo, useState } from "react";
import {
  getDashboardSummary,
  readDashboardSummaryCache,
  writeDashboardSummaryCache,
} from "../api/dashboard";
import { getProjects } from "../api/projects";
import { getSkills }   from "../api/skills";
import { getWorkshops } from "../api/workshops";

// ── Agent catalog ─────────────────────────────────────────────────────────────
const AGENT_CATALOG = [
  {
    id:    "feature-generator",
    icon:  "auto_awesome",
    name:  "Feature Generator",
    desc:  "Generate PM-ready specs from discovery inputs.",
    color: "text-violet-400",
    bg:    "bg-violet-500/10",
  },
  {
    id:    "story-generator",
    icon:  "receipt_long",
    name:  "Story Generator",
    desc:  "Break a feature into user stories.",
    color: "text-emerald-400",
    bg:    "bg-emerald-500/10",
  },
  {
    id:    "feature-refiner",
    icon:  "auto_fix_high",
    name:  "Feature Refiner",
    desc:  "Evaluate and refine feature specs.",
    color: "text-indigo-400",
    bg:    "bg-indigo-500/10",
  },
  {
    id:    "story-refiner",
    icon:  "auto_fix_high",
    name:  "Story Refiner",
    desc:  "Improve clarity and testability of stories.",
    color: "text-blue-400",
    bg:    "bg-blue-500/10",
  },
  {
    id:    "story-slicer",
    icon:  "call_split",
    name:  "Story Slicer",
    desc:  "Decompose large stories into slices.",
    color: "text-amber-400",
    bg:    "bg-amber-500/10",
  },
  {
    id:    "feature-prioritizer",
    icon:  "sort",
    name:  "Feature Prioritizer",
    desc:  "Rank features by impact vs effort.",
    color: "text-orange-400",
    bg:    "bg-orange-500/10",
  },
];

// ── Skill type metadata ───────────────────────────────────────────────────────
const SKILL_TYPES = [
  "feature_spec",
  "story_spec",
  "story_refinement",
  "story_slicing",
  "feature_refinement",
  "feature_prioritization",
];

const SKILL_TYPE_META = {
  feature_spec:           { label: "Feature Spec",           icon: "auto_awesome",  badgeCls: "bg-violet-50 text-violet-600 border-violet-100",   iconCls: "text-violet-500" },
  story_spec:             { label: "Story Spec",             icon: "menu_book",     badgeCls: "bg-emerald-50 text-emerald-600 border-emerald-100", iconCls: "text-emerald-500" },
  story_refinement:       { label: "Story Refinement",       icon: "auto_fix_high", badgeCls: "bg-blue-50 text-blue-600 border-blue-100",           iconCls: "text-blue-500" },
  story_slicing:          { label: "Story Slicing",          icon: "call_split",    badgeCls: "bg-amber-50 text-amber-600 border-amber-100",         iconCls: "text-amber-500" },
  feature_refinement:     { label: "Feature Refinement",     icon: "auto_fix_high", badgeCls: "bg-indigo-50 text-indigo-600 border-indigo-100",      iconCls: "text-indigo-500" },
  feature_prioritization: { label: "Feature Prioritization", icon: "sort",          badgeCls: "bg-orange-50 text-orange-600 border-orange-100",      iconCls: "text-orange-500" },
};

// ── Project / workshop status ─────────────────────────────────────────────────
const PROJECT_STATUS = {
  active:    { dot: "bg-emerald-500 animate-pulse" },
  on_hold:   { dot: "bg-amber-400"                 },
  completed: { dot: "bg-slate-300"                 },
  archived:  { dot: "bg-slate-200"                 },
};

const WS_STATUS_ICON = {
  active:    { icon: "play_arrow",   color: "text-primary"     },
  completed: { icon: "check_circle", color: "text-emerald-500" },
  draft:     { icon: "edit_note",    color: "text-slate-400"   },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function SummarySkeleton() {
  return (
    <div className="flex items-center justify-between">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={["flex-1 text-center animate-pulse", i < 3 ? "border-r border-slate-100" : ""].join(" ")}
        >
          <div className="h-10 w-16 bg-surface-container rounded mx-auto" />
          <div className="h-3 w-20 bg-surface-container rounded mx-auto mt-3" />
        </div>
      ))}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard({ onNavigate }) {
  const [summary, setSummary]               = useState(() => readDashboardSummaryCache());
  const [summaryLoading, setSummaryLoading] = useState(() => !readDashboardSummaryCache());
  const [summaryError, setSummaryError]     = useState(null);

  const [projects, setProjects]             = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const [skills, setSkills]                 = useState([]);
  const [skillsLoading, setSkillsLoading]   = useState(true);

  const [recentWorkshops, setRecentWorkshops] = useState([]);

  useEffect(() => {
    let cancelled = false;

    // Dashboard summary
    if (!summary) setSummaryLoading(true);
    setSummaryError(null);
    getDashboardSummary()
      .then((result) => {
        if (!cancelled) { setSummary(result); writeDashboardSummaryCache(result); }
      })
      .catch((e) => { if (!cancelled) setSummaryError(e.message); })
      .finally(() => { if (!cancelled) setSummaryLoading(false); });

    // Projects
    getProjects()
      .then((data) => {
        if (!cancelled) setProjects(Array.isArray(data) ? data : (data.projects ?? []));
      })
      .catch(() => { if (!cancelled) setProjects([]); })
      .finally(() => { if (!cancelled) setProjectsLoading(false); });

    // Skills — all types
    getSkills()
      .then((data) => {
        if (!cancelled) setSkills(Array.isArray(data) ? data : (data.skills ?? []));
      })
      .catch(() => { if (!cancelled) setSkills([]); })
      .finally(() => { if (!cancelled) setSkillsLoading(false); });

    // Recent workshops — global, no project filter
    getWorkshops()
      .then((data) => {
        const rows = Array.isArray(data) ? data : (data.workshops ?? []);
        const sorted = [...rows].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        if (!cancelled) setRecentWorkshops(sorted.slice(0, 5));
      })
      .catch(() => { if (!cancelled) setRecentWorkshops([]); });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => ([
    { value: String(summary?.workshops    ?? 0), label: "Workshops",     highlight: false },
    { value: String(summary?.initiatives  ?? 0), label: "Initiatives",   highlight: false },
    { value: String(summary?.features     ?? 0), label: "Features",      highlight: false },
    { value: String(summary?.ready_stories ?? 0), label: "Ready Stories", highlight: true  },
  ]), [summary]);

  // Pipeline bar proportions derived from live counts
  const pipelineTotal =
    (summary?.workshops    ?? 0) +
    (summary?.initiatives  ?? 0) +
    (summary?.features     ?? 0) +
    (summary?.ready_stories ?? 0);

  const pipeline = pipelineTotal > 0
    ? [
        { label: "Discovery",  pct: (summary.workshops    / pipelineTotal * 100).toFixed(1), color: "bg-blue-200" },
        { label: "Mapping",    pct: (summary.initiatives  / pipelineTotal * 100).toFixed(1), color: "bg-blue-300" },
        { label: "Definition", pct: (summary.features     / pipelineTotal * 100).toFixed(1), color: "bg-blue-500" },
        { label: "Execution",  pct: (summary.ready_stories / pipelineTotal * 100).toFixed(1), color: "bg-blue-700" },
      ]
    : [
        { label: "Discovery",  pct: 25, color: "bg-blue-200" },
        { label: "Mapping",    pct: 25, color: "bg-blue-300" },
        { label: "Definition", pct: 25, color: "bg-blue-500" },
        { label: "Execution",  pct: 25, color: "bg-blue-700" },
      ];

  // Skills map: type → active skill (or null = default not yet saved)
  const skillsByType = useMemo(() => {
    const map = {};
    SKILL_TYPES.forEach((type) => {
      const typeSkills = skills.filter((s) => s.skill_type === type);
      map[type] = typeSkills.find((s) => s.is_active) ?? typeSkills[0] ?? null;
    });
    return map;
  }, [skills]);

  return (
    <div className="px-10 py-12">

      {/* ── Page header ── */}
      <section className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface mb-2">
            Project Hub
          </h2>
          <p className="text-on-surface-variant font-medium">
            Enterprise intelligence is managing{" "}
            <span className="text-primary font-semibold">
              {summary?.active_flows ?? 0} active flow{(summary?.active_flows ?? 0) === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate("projects")}
            className="px-5 py-2 rounded-md border border-outline text-on-surface-variant font-semibold text-sm hover:bg-surface-container transition-colors"
          >
            View All Projects
          </button>
          <button
            onClick={() => onNavigate("projects")}
            className="px-5 py-2 rounded-md bg-primary text-white font-bold text-sm hover:bg-primary-dim transition-all active:scale-95 flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            New Project
          </button>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-8">

        {/* ── Row 1 left: Strategic Alignment ── */}
        <div className="col-span-12 lg:col-span-8 bg-surface border border-outline rounded-xl p-8 shadow-card">
          <h3 className="text-primary font-headline text-xs font-bold tracking-widest uppercase mb-10">
            Strategic Alignment
          </h3>

          {summaryError ? (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
              <span className="material-symbols-outlined text-error text-[18px]">error</span>
              <p className="text-sm text-red-700">
                Couldn't load live portfolio metrics. The rest of the dashboard is still available.
              </p>
            </div>
          ) : summaryLoading ? (
            <SummarySkeleton />
          ) : (
            <div className="flex items-center justify-between">
              {stats.map(({ value, label, highlight }, i) => (
                <div
                  key={label}
                  className={["flex-1 text-center", i < stats.length - 1 ? "border-r border-slate-100" : ""].join(" ")}
                >
                  <p className={["text-4xl font-headline font-bold", highlight ? "text-primary" : "text-on-surface"].join(" ")}>
                    {value}
                  </p>
                  <p className="text-[11px] text-on-surface-variant font-bold uppercase mt-2">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Pipeline bar — proportions driven by live counts */}
          <div className="mt-12 h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
            {pipeline.map((seg) => (
              <div key={seg.label} className={`h-full ${seg.color} transition-all`} style={{ width: `${seg.pct}%` }} />
            ))}
          </div>
          <div className="mt-4 flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            {pipeline.map((seg) => <span key={seg.label}>{seg.label}</span>)}
          </div>
        </div>

        {/* ── Row 1 right: Active Projects ── */}
        <div className="col-span-12 lg:col-span-4 bg-surface rounded-xl p-6 border border-outline shadow-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-primary font-headline text-xs font-bold tracking-widest uppercase">
              Active Projects
            </h3>
            <button
              onClick={() => onNavigate("projects")}
              className="text-[10px] font-bold text-primary uppercase tracking-widest hover:text-primary-dim transition-colors"
            >
              View All
            </button>
          </div>

          {projectsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-surface-container shrink-0" />
                  <div className="h-3 flex-1 bg-surface-container rounded" />
                  <div className="h-3 w-10 bg-surface-container rounded" />
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <span className="material-symbols-outlined text-[28px] text-on-surface-variant/30">folder_open</span>
              <p className="text-[12px] text-on-surface-variant">No projects yet.</p>
              <button
                onClick={() => onNavigate("projects")}
                className="text-[11px] font-bold text-primary hover:text-primary-dim transition-colors"
              >
                Create your first project →
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {projects.slice(0, 6).map((p) => {
                const sc = PROJECT_STATUS[p.status] ?? PROJECT_STATUS.active;
                return (
                  <button
                    key={p.id}
                    onClick={() => onNavigate("project-detail", p)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container transition-colors text-left group"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
                    <span className="text-sm font-semibold text-on-surface flex-1 truncate group-hover:text-primary transition-colors">
                      {p.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(p.feature_count ?? 0) > 0 && (
                        <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container border border-outline px-1.5 py-0.5 rounded">
                          {p.feature_count}F
                        </span>
                      )}
                      {(p.story_count ?? 0) > 0 && (
                        <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container border border-outline px-1.5 py-0.5 rounded">
                          {p.story_count}S
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {projects.length > 6 && (
                <button
                  onClick={() => onNavigate("projects")}
                  className="w-full text-center text-[11px] font-bold text-on-surface-variant hover:text-primary transition-colors pt-2"
                >
                  +{projects.length - 6} more
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Row 2: Agent Hero ── */}
        <div className="col-span-12">
          <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-8">
            {/* Blue gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-blue-600/15 to-slate-900/90 pointer-events-none" />
            {/* Dot-grid texture */}
            <div
              className="absolute inset-0 opacity-[0.035] pointer-events-none"
              style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }}
            />
            {/* Faint radial glow top-left */}
            <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300/70 mb-1">
                    Powered by ProductOS
                  </p>
                  <h3 className="text-xl font-headline font-bold text-white">AI Agents</h3>
                </div>
                <span className="flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/15 rounded-full text-[11px] font-bold text-white/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {AGENT_CATALOG.length} agents ready
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {AGENT_CATALOG.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => onNavigate("projects")}
                    className="flex flex-col items-start p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group text-left"
                  >
                    <div className={`w-9 h-9 rounded-xl ${agent.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <span
                        className={`material-symbols-outlined text-[18px] ${agent.color}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {agent.icon}
                      </span>
                    </div>
                    <p className="text-[12px] font-bold text-white leading-snug mb-1">{agent.name}</p>
                    <p className="text-[10px] text-white/45 leading-relaxed">{agent.desc}</p>
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-white/25 mt-6">
                Select a project to run an agent in context.
              </p>
            </div>
          </div>
        </div>

        {/* ── Row 3 left: Active Skills ── */}
        <div className="col-span-12 lg:col-span-7">
          <div className="bg-surface rounded-xl p-8 border border-outline h-full shadow-card">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-primary font-headline text-xs font-bold tracking-widest uppercase">
                Active Skills
              </h3>
              <button
                onClick={() => onNavigate("skills")}
                className="text-[10px] font-bold text-primary uppercase tracking-widest hover:text-primary-dim transition-colors"
              >
                Configure
              </button>
            </div>

            {skillsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[60px] bg-surface-container rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {SKILL_TYPES.map((type) => {
                  const meta  = SKILL_TYPE_META[type];
                  const skill = skillsByType[type];
                  return (
                    <button
                      key={type}
                      onClick={() => onNavigate("skills")}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-outline bg-surface hover:bg-surface-container/60 transition-colors group text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center shrink-0 border border-outline group-hover:bg-surface transition-colors">
                        <span
                          className={`material-symbols-outlined text-[15px] ${meta.iconCls}`}
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {meta.icon}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${meta.badgeCls}`}>
                          {meta.label}
                        </span>
                        <p className="text-[11px] font-semibold text-on-surface mt-1 truncate">
                          {skill ? skill.name : "Default"}
                        </p>
                      </div>
                      {skill?.is_active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 3 right: Recent Activity ── */}
        <div className="col-span-12 lg:col-span-5">
          <div className="bg-surface rounded-xl p-8 border border-outline h-full shadow-card">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-primary font-headline text-xs font-bold tracking-widest uppercase">
                Recent Activity
              </h3>
              <button
                onClick={() => onNavigate("projects")}
                className="text-[10px] font-bold text-primary uppercase tracking-widest hover:text-primary-dim transition-colors"
              >
                View All
              </button>
            </div>

            {recentWorkshops.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant/20">history</span>
                <p className="text-[12px] text-on-surface-variant">No recent activity yet.</p>
                <p className="text-[11px] text-on-surface-variant/50">Start a workshop to see activity here.</p>
              </div>
            ) : (
              <div className="relative space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
                {recentWorkshops.map((ws) => {
                  const sc   = WS_STATUS_ICON[ws.status] ?? WS_STATUS_ICON.draft;
                  const time = relativeTime(ws.updated_at);
                  return (
                    <div key={ws.id} className="relative pl-10">
                      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-2 border-outline flex items-center justify-center z-10">
                        <span
                          className={`material-symbols-outlined text-[10px] ${sc.color}`}
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {sc.icon}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-on-surface leading-snug">
                        {ws.title || "Untitled Workshop"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-on-surface-variant capitalize">{ws.status ?? "draft"}</span>
                        {time && (
                          <>
                            <span className="text-on-surface-variant/30">·</span>
                            <span className="text-[11px] text-on-surface-variant">{time}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => onNavigate("projects")}
              className="w-full mt-10 py-3 rounded border border-outline text-[10px] font-bold text-on-surface-variant hover:text-primary hover:border-blue-200 transition-all uppercase tracking-widest"
            >
              View All Projects
            </button>
          </div>
        </div>

      </div>

      {/* ── FAB ── */}
      <div className="fixed bottom-8 right-8">
        <button
          onClick={() => onNavigate("projects")}
          className="w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-blue-400/20 flex items-center justify-center hover:bg-primary-dim transition-all hover:scale-105 active:scale-95 group"
        >
          <span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform">bolt</span>
        </button>
      </div>

    </div>
  );
}
