import { useState, useEffect, useRef } from "react";
import {
  createWorkflow, updateWorkflow, getWorkflow,
  loadCurrentWorkflowId, storeCurrentWorkflowId,
  getBacklogRefinementSource,
} from "../api/workflows";
import {
  startBacklogRefinementAnalysisJob,
  startBacklogRefinementExecutionJob,
  getGenerationJob,
} from "../api/agents";
import { openJobSocket } from "../api/jobs";
import {
  getCachedJiraConnectionContext,
  persistJiraSelectedProject,
  preloadJiraConnectionContext,
} from "../api/jira";
import { getProjectTeam } from "../api/projects";

const BACKLOG_REFINEMENT_RESTORE_KEY = "backlog_refinement_restore_pending";

// ─── Animation keyframes injected once ───────────────────────────────────────
const ANIM_CSS = `
@keyframes bucketItemIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes bucketColIn {
  from { opacity: 0; transform: translateY(20px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes healthBarGrow {
  from { width: 0; }
}
@keyframes routingPulse {
  0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
  50% { box-shadow: 0 0 0 6px transparent; opacity: 0.7; }
}
`;

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS = [
  { key: "source",  label: "Source",  icon: "cloud_download" },
  { key: "analyze", label: "Analyze", icon: "analytics"      },
  { key: "review",  label: "Review",  icon: "category"       },
  { key: "done",    label: "Done",    icon: "task_alt"        },
];

// ─── Bucket config ────────────────────────────────────────────────────────────
const BUCKET_CFG = {
  generate: {
    label:      "Generate",
    icon:       "auto_fix_high",
    desc:       "Features with no or too few stories",
    headerFrom: "#7c3aed",
    headerTo:   "#6d28d9",
    leftBar:    "#8b5cf6",
    badgeBg:    "bg-violet-100",
    badgeText:  "text-violet-700",
    spBg:       "bg-violet-600",
    cardBg:     "bg-white",
    colBg:      "bg-gradient-to-b from-violet-50/60 to-white",
    check:      "accent-violet-600",
    countText:  "#ddd6fe",
    emptyText:  "#c4b5fd",
  },
  refine: {
    label:      "Refine",
    icon:       "edit_note",
    desc:       "Weak detail, missing story points, or fails Story Refiner quality evaluation",
    headerFrom: "#d97706",
    headerTo:   "#b45309",
    leftBar:    "#f59e0b",
    badgeBg:    "bg-amber-100",
    badgeText:  "text-amber-700",
    spBg:       "bg-amber-500",
    cardBg:     "bg-white",
    colBg:      "bg-gradient-to-b from-amber-50/60 to-white",
    check:      "accent-amber-600",
    countText:  "#fde68a",
    emptyText:  "#fcd34d",
  },
  slice: {
    label:      "Slice",
    icon:       "content_cut",
    desc:       "Stories over 8 story points",
    headerFrom: "#ea580c",
    headerTo:   "#c2410c",
    leftBar:    "#f97316",
    badgeBg:    "bg-orange-100",
    badgeText:  "text-orange-700",
    spBg:       "bg-orange-500",
    cardBg:     "bg-white",
    colBg:      "bg-gradient-to-b from-orange-50/60 to-white",
    check:      "accent-orange-600",
    countText:  "#fed7aa",
    emptyText:  "#fdba74",
  },
  ready: {
    label:      "Ready",
    icon:       "task_alt",
    desc:       "Passes Story Refiner quality evaluation and ≤8 points",
    headerFrom: "#059669",
    headerTo:   "#047857",
    leftBar:    "#10b981",
    badgeBg:    "bg-emerald-100",
    badgeText:  "text-emerald-700",
    spBg:       "bg-emerald-600",
    cardBg:     "bg-white",
    colBg:      "bg-gradient-to-b from-emerald-50/60 to-white",
    check:      "accent-emerald-600",
    countText:  "#a7f3d0",
    emptyText:  "#6ee7b7",
  },
};

const BUCKET_KEYS = ["generate", "refine", "slice", "ready"];

function getStoryId(story) {
  return story.id ?? story.story_id ?? story.issue_key ?? null;
}

function totalPoints(items) {
  return items.reduce((sum, s) => sum + (s.story_points ?? s.points ?? 0), 0);
}

// ─── Flow bar ─────────────────────────────────────────────────────────────────
function FlowBar({ current }) {
  const currentIdx = STEPS.findIndex(s => s.key === current);
  return (
    <div className="flex items-start mb-8">
      {STEPS.map((step, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.key} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={[
                "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                done   ? "bg-primary border-primary"                       :
                active ? "bg-white border-primary ring-4 ring-primary/15"  :
                         "bg-surface-container border-outline",
              ].join(" ")}>
                {done ? (
                  <span className="material-symbols-outlined text-[14px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                ) : (
                  <span className={`material-symbols-outlined text-[14px] ${active ? "text-primary" : "text-on-surface-variant/40"}`}>{step.icon}</span>
                )}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${active ? "text-primary" : done ? "text-primary/60" : "text-on-surface-variant/40"}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-[2px] mt-4 mx-2 transition-all duration-500 ${done ? "bg-primary" : "bg-outline"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Health panel ─────────────────────────────────────────────────────────────
function HealthPanel({ health, summary }) {
  const current   = health?.total_backlog_story_points   ?? 0;
  const target    = health?.minimum_ready_backlog_target ?? 0;
  const shortfall = Math.max(0, target - current);
  const surplus   = Math.max(0, current - target);
  const isHealthy = current >= target;
  const pct       = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900 mb-8 shadow-xl">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      />
      <div className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${isHealthy ? "from-emerald-600/20 via-transparent to-blue-600/15" : "from-red-600/20 via-transparent to-orange-600/15"}`} />

      <div className="relative z-10 grid grid-cols-[1fr_1fr_1fr_2fr]">

        {/* Ready */}
        <div className="px-8 py-7 border-r border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-0.5">Current Backlog Points</p>
          <p className="text-[11px] text-slate-400 mb-4">Currently available in backlog</p>
          <p className="text-[56px] font-black text-white leading-none tracking-tight">{current}</p>
        </div>

        {/* Target */}
        <div className="px-8 py-7 border-r border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-0.5">Minimum Backlog Floor</p>
          <p className="text-[11px] text-slate-400 mb-4">Baseline expectation (2×velocity), not a cap</p>
          <p className="text-[56px] font-black text-white leading-none tracking-tight">{target}</p>
        </div>

        {/* Shortfall / Surplus */}
        <div className="px-8 py-7 border-r border-white/10">
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${isHealthy ? "text-emerald-400" : "text-red-400"}`}>
            {isHealthy ? "Surplus" : "Shortfall"}
          </p>
          <p className="text-[11px] text-slate-400 mb-4">{isHealthy ? "Above minimum floor" : "Below minimum floor"}</p>
          <p className={`text-[56px] font-black leading-none tracking-tight ${isHealthy ? "text-emerald-400" : "text-red-400"}`}>
            {isHealthy ? surplus : shortfall}
          </p>
        </div>

        {/* Readiness bar + summary */}
        <div className="px-8 py-7">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Backlog Floor Coverage</p>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isHealthy ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
              {pct}%
            </span>
          </div>
          <div className="h-2.5 bg-white/10 rounded-full overflow-hidden mb-5">
            <div
              className={`h-full rounded-full ${isHealthy ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-red-500 to-orange-400"}`}
              style={{ width: `${pct}%`, animation: "healthBarGrow 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both" }}
            />
          </div>
          {summary && (
            <p className="text-[12px] text-slate-400 leading-relaxed line-clamp-4">{summary}</p>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Story card inside a bucket ───────────────────────────────────────────────
function StoryItem({ story, cfg, approved, onToggle, index }) {
  const id    = getStoryId(story);
  const title = story.title ?? story.summary ?? story.name ?? "Untitled Story";
  const sp    = story.story_points ?? story.points ?? null;
  const key   = story.issue_key ?? story.key ?? null;

  return (
    <div
      className={[
        "bucket-item relative pl-4 pr-3 py-3 rounded-xl border cursor-pointer transition-all duration-200",
        approved
          ? "bg-white border-outline shadow-sm hover:shadow-md hover:-translate-y-px"
          : "bg-transparent border-outline/30 opacity-40 hover:opacity-60",
      ].join(" ")}
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={() => onToggle(id)}
    >
      {/* Left color accent bar */}
      <div
        className={`absolute left-0 inset-y-0 w-[3px] rounded-l-xl transition-opacity duration-200 ${approved ? "opacity-100" : "opacity-0"}`}
        style={{ backgroundColor: cfg.leftBar }}
      />

      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          className={`mt-0.5 shrink-0 ${cfg.check}`}
          checked={approved}
          onChange={() => {}}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-on-surface leading-snug line-clamp-2">{title}</p>
          {key && <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">{key}</p>}
        </div>
        {sp != null && (
          <span className={`text-[10px] font-black shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white`}
            style={{ backgroundColor: cfg.leftBar }}
          >
            {sp}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Bucket column ────────────────────────────────────────────────────────────
function BucketColumn({ bucketKey, items, approvedSet, onToggle, colIndex }) {
  const cfg          = BUCKET_CFG[bucketKey];
  const approvedCount = items.filter(s => approvedSet.has(getStoryId(s))).length;
  const approvedPts  = items
    .filter(s => approvedSet.has(getStoryId(s)))
    .reduce((sum, s) => sum + (s.story_points ?? s.points ?? 0), 0);
  const allSelected  = items.length > 0 && approvedCount === items.length;

  function toggleAll() {
    items.forEach(s => {
      const id = getStoryId(s);
      const currentlyApproved = approvedSet.has(id);
      if (allSelected ? currentlyApproved : !currentlyApproved) onToggle(bucketKey, id);
    });
  }

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden border border-outline shadow-card"
      style={{ animation: `bucketColIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${colIndex * 80}ms both` }}
    >
      {/* Column header — gradient */}
      <div
        className="px-4 py-5 flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${cfg.headerFrom}, ${cfg.headerTo})` }}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          {/* Icon + label */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-[18px] text-white"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {cfg.icon}
              </span>
            </div>
            <div>
              <p className="text-white font-headline font-bold text-[15px] leading-tight">{cfg.label}</p>
              <p className="text-white/60 text-[10px] leading-tight mt-0.5">{cfg.desc}</p>
            </div>
          </div>

          {/* Count */}
          <div className="text-right shrink-0" style={{ color: cfg.countText }}>
            <p className="text-3xl font-black leading-none">{items.length}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">items</p>
          </div>
        </div>

        {/* Points + toggle all */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white/50">
            {approvedPts > 0 ? `${approvedPts} pts approved` : ""}
          </span>
          {items.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-[10px] font-bold text-white/70 hover:text-white transition-colors underline underline-offset-2"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>
      </div>

      {/* Item list */}
      <div className={`flex-1 p-3 space-y-2 overflow-y-auto max-h-[420px] ${cfg.colBg}`}>
        {items.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-2">
            <span
              className="material-symbols-outlined text-[28px]"
              style={{ color: cfg.emptyText, fontVariationSettings: "'FILL' 1" }}
            >
              inbox
            </span>
            <p className="text-[11px] text-on-surface-variant/50">Nothing routed here</p>
          </div>
        ) : (
          items.map((story, i) => (
            <StoryItem
              key={getStoryId(story) ?? i}
              story={story}
              cfg={cfg}
              approved={approvedSet.has(getStoryId(story))}
              onToggle={(id) => onToggle(bucketKey, id)}
              index={i}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="px-4 py-2.5 border-t border-outline bg-surface-container/40 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-on-surface-variant">
            <span className="font-bold text-on-surface">{approvedCount}</span>/{items.length} approved
          </p>
          {approvedPts > 0 && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badgeBg} ${cfg.badgeText}`}>
              {approvedPts} pts
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Analysis progress ────────────────────────────────────────────────────────
function AnalysisProgress({ message, pct }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-8">
      {/* Animated routing icon */}
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
          <span
            className="material-symbols-outlined text-[36px] text-primary"
            style={{ fontVariationSettings: "'FILL' 1", animation: "routingPulse 2s ease-in-out infinite" }}
          >
            analytics
          </span>
        </div>
        {/* Orbiting dots */}
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="absolute w-2.5 h-2.5 rounded-full bg-primary"
            style={{
              top: "50%",
              left: "50%",
              transform: `rotate(${i * 90}deg) translate(38px) translate(-50%, -50%)`,
              animation: `routingPulse 1.6s ease-in-out ${i * 0.4}s infinite`,
              opacity: 0.6,
            }}
          />
        ))}
      </div>

      <div className="text-center">
        <p className="text-lg font-headline font-bold text-on-surface mb-1">Analysing backlog…</p>
        <p className="text-[13px] text-on-surface-variant max-w-xs leading-relaxed">{message}</p>
      </div>

      {/* Progress bar */}
      <div className="w-80">
        <div className="h-2 bg-surface-container rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-on-surface-variant/60 text-center mt-2">{pct}%</p>
      </div>

      {/* Routing labels animating underneath */}
      <div className="flex items-center gap-6 mt-2">
        {BUCKET_KEYS.map((key, i) => {
          const cfg = BUCKET_CFG[key];
          return (
            <div
              key={key}
              className="flex items-center gap-1.5 opacity-0"
              style={{ animation: `bucketItemIn 0.5s ease ${0.3 + i * 0.15}s forwards` }}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.leftBar }} />
              <span className="text-[11px] font-semibold text-on-surface-variant">{cfg.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Source stat chip ─────────────────────────────────────────────────────────
function StatChip({ icon, label, value, accent }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 bg-surface border border-outline rounded-xl">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent.bg}`}>
        <span className={`material-symbols-outlined text-[18px] ${accent.text}`} style={{ fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
        <p className="text-xl font-black text-on-surface leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ─── Bucket label helpers for result rows ────────────────────────────────────
const RESULT_BUCKET_CFG = {
  generate: { label: "Generate", icon: "auto_fix_high",  bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", dot: "#8b5cf6" },
  refine:   { label: "Refine",   icon: "edit_note",      bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  dot: "#f59e0b" },
  slice:    { label: "Slice",    icon: "content_cut",    bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "#f97316" },
  ready:    { label: "Ready",    icon: "task_alt",       bg: "bg-emerald-50",text: "text-emerald-700",border: "border-emerald-200",dot: "#10b981" },
};

// ─── Per-item execution result row ───────────────────────────────────────────
function ResultRow({ item }) {
  const [expanded, setExpanded] = useState(false);
  const bucket  = (item.bucket ?? "").toLowerCase();
  const cfg     = RESULT_BUCKET_CFG[bucket] ?? RESULT_BUCKET_CFG.generate;
  const status  = item.status ?? "completed";
  const success = status === "completed" || status === "success";
  const isSlice = bucket === "slice";

  const createdIssues = item.created_issues ?? item.created_jira_issues ?? [];
  const updatedIssue  = item.updated_issue  ?? item.updated_jira_issue  ?? null;
  const message       = item.message ?? null;

  return (
    <div className={`border rounded-xl overflow-hidden ${success ? "border-outline" : "border-red-100"}`}>
      {/* Row header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-container/40 transition-colors ${success ? "bg-surface" : "bg-red-50/60"}`}
        onClick={() => (createdIssues.length > 0 || updatedIssue || message) && setExpanded(e => !e)}
      >
        {/* Bucket chip */}
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          {cfg.label}
        </span>

        {/* Source key */}
        <span className="text-[11px] font-mono font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded border border-outline shrink-0">
          {item.source_issue_key ?? item.issue_key ?? "—"}
        </span>

        {/* Status */}
        <span className={`flex items-center gap-1 text-[11px] font-semibold ${success ? "text-emerald-600" : "text-red-600"}`}>
          <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {success ? "check_circle" : "error"}
          </span>
          {success ? "Done" : "Failed"}
        </span>

        {/* Brief outcome */}
        <span className="text-[11px] text-on-surface-variant flex-1 truncate">
          {isSlice && updatedIssue
            ? `Updated ${updatedIssue.key ?? updatedIssue.issue_key ?? "original"} · ${createdIssues.length} sibling${createdIssues.length !== 1 ? "s" : ""} created`
            : createdIssues.length > 0
              ? `${createdIssues.length} issue${createdIssues.length !== 1 ? "s" : ""} created`
              : updatedIssue
                ? `Updated ${updatedIssue.key ?? updatedIssue.issue_key ?? "issue"}`
                : message ?? ""}
        </span>

        {(createdIssues.length > 0 || updatedIssue || message) && (
          <span className="material-symbols-outlined text-[14px] text-on-surface-variant shrink-0">
            {expanded ? "expand_less" : "expand_more"}
          </span>
        )}
      </div>

      {/* Expandable detail */}
      {expanded && (
        <div className="border-t border-outline px-4 py-3 space-y-3 bg-surface-container/20">

          {/* Slice: updated original */}
          {isSlice && updatedIssue && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Updated Original Story</p>
              <div className="flex items-center gap-2 p-2.5 bg-surface border border-outline rounded-lg">
                <span className="text-[10px] font-mono font-bold text-primary bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15 shrink-0">
                  {updatedIssue.key ?? updatedIssue.issue_key}
                </span>
                <p className="text-[11px] text-on-surface truncate">{updatedIssue.summary ?? updatedIssue.title ?? "Updated"}</p>
              </div>
            </div>
          )}

          {/* Created issues */}
          {createdIssues.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                {isSlice ? "New Sibling Stories" : "Created Issues"}
              </p>
              <div className="space-y-1.5">
                {createdIssues.map((issue, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 bg-surface border border-outline rounded-lg">
                    <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                      {issue.key ?? issue.issue_key ?? `#${i + 1}`}
                    </span>
                    <p className="text-[11px] text-on-surface truncate">{issue.summary ?? issue.title ?? "New issue"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Non-slice updated issue */}
          {!isSlice && updatedIssue && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Updated Issue</p>
              <div className="flex items-center gap-2 p-2.5 bg-surface border border-outline rounded-lg">
                <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                  {updatedIssue.key ?? updatedIssue.issue_key}
                </span>
                <p className="text-[11px] text-on-surface truncate">{updatedIssue.summary ?? updatedIssue.title ?? "Updated"}</p>
              </div>
            </div>
          )}

          {/* Message */}
          {message && (
            <p className="text-[11px] text-on-surface-variant leading-relaxed">{message}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Execution results screen ─────────────────────────────────────────────────
function ExecutionResults({ execResult, onBack, onRunAgain }) {
  const execution = execResult?.execution ?? execResult ?? {};
  const results   = execResult?.results   ?? [];

  const created = execution.created_story_count ?? results.filter(r => (r.bucket ?? "").toLowerCase() === "generate").length;
  const updated = execution.updated_story_count ?? results.filter(r => (r.bucket ?? "").toLowerCase() === "refine").length;
  const sliced  = execution.sliced_story_count  ?? results.filter(r => (r.bucket ?? "").toLowerCase() === "slice").length;
  const failed  = results.filter(r => r.status !== "completed" && r.status !== "success").length;

  return (
    <div className="space-y-8">

      {/* Summary panel */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-xl">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 via-transparent to-blue-600/15 pointer-events-none" />

        <div className="relative z-10 px-10 py-8 flex items-center gap-8">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px] text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>
              task_alt
            </span>
          </div>

          <div className="flex-1">
            <p className="text-white font-headline font-bold text-xl mb-0.5">Refinement Complete</p>
            <p className="text-slate-400 text-[12px]">
              Your approved plan has been executed in Jira.
              {failed > 0 && <span className="text-red-400 ml-1">{failed} item{failed !== 1 ? "s" : ""} failed — see details below.</span>}
            </p>
          </div>

          {/* Count chips */}
          <div className="flex items-center gap-3 shrink-0">
            {created > 0 && (
              <div className="text-center">
                <p className="text-[36px] font-black text-violet-400 leading-none">{created}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Created</p>
              </div>
            )}
            {updated > 0 && (
              <div className="text-center">
                <p className="text-[36px] font-black text-amber-400 leading-none">{updated}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Refined</p>
              </div>
            )}
            {sliced > 0 && (
              <div className="text-center">
                <p className="text-[36px] font-black text-orange-400 leading-none">{sliced}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Sliced</p>
              </div>
            )}
          </div>
        </div>

        {/* Slice behavior note */}
        {sliced > 0 && (
          <div className="relative z-10 border-t border-white/8 px-10 py-3">
            <p className="text-[11px] text-slate-500">
              <span className="text-slate-400 font-semibold">Sliced stories:</span> the original Jira story was updated to the first smaller piece. Additional scope was created as new sibling stories in the same epic.
            </p>
          </div>
        )}
      </div>

      {/* Per-item results */}
      {results.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Execution Results</h3>
            <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full border border-outline">{results.length}</span>
          </div>
          <div className="space-y-2">
            {results.map((item, i) => <ResultRow key={i} item={item} />)}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline text-sm font-bold rounded-xl hover:border-primary/40 hover:text-primary transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Project
        </button>
        <button
          onClick={onRunAgain}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dim transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Run Again
        </button>
      </div>

    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BacklogRefinementWorkflow({ onNavigate, project }) {
  const projectId = project?.id ?? null;

  // Phase: source | running | review | done
  const [phase, setPhase]           = useState("source");
  const [workflowId, setWorkflowId] = useState(() => loadCurrentWorkflowId());

  // Jira
  const [jiraState, setJiraState]       = useState("checking");
  const [jiraProjects, setJiraProjects] = useState([]);
  const [selectedProjectKey, setSelectedProjectKey] = useState("");

  // Source data
  const [sourceData, setSourceData]   = useState(null);
  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceError, setSourceError] = useState(null);

  // Team / capacity
  const [teamData, setTeamData] = useState(null);

  // Analysis
  const [analysis, setAnalysis] = useState(null); // { generate, refine, slice, ready, health, summary }

  // Approval: { generate: Set, refine: Set, slice: Set, ready: Set }
  const [approvedSets, setApprovedSets] = useState(null);

  // Run progress
  const [progress, setProgress] = useState({ message: "Initialising…", pct: 5 });

  const [execResult, setExecResult] = useState(null);

  const [error, setError] = useState(null);
  const socketRef      = useRef(null);
  // Accumulated state_payload — merged across all steps so no key is ever dropped on PATCH
  const statePayloadRef = useRef({});

  // ── On mount: check Jira + restore ─────────────────────────────────────────
  useEffect(() => {
    hydrateJiraFromCache();
    checkJira();
    if (projectId) loadTeam();
    if (workflowId && sessionStorage.getItem(BACKLOG_REFINEMENT_RESTORE_KEY) === "true") {
      restoreFromWorkflow(workflowId);
      sessionStorage.removeItem(BACKLOG_REFINEMENT_RESTORE_KEY);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { socketRef.current?.close(); }, []);

  useEffect(() => {
    if (selectedProjectKey) persistJiraSelectedProject(selectedProjectKey);
  }, [selectedProjectKey]);

  function hydrateJiraFromCache() {
    const cached = getCachedJiraConnectionContext();
    if (cached?.connected) {
      setJiraState("connected");
      setJiraProjects(Array.isArray(cached.projects) ? cached.projects : []);
      if (cached.selectedProject) {
        setSelectedProjectKey((current) => current || cached.selectedProject);
      }
      return;
    }
    setJiraState("checking");
  }

  async function checkJira() {
    try {
      const context = await preloadJiraConnectionContext();
      if (context?.connected) {
        setJiraState("connected");
        setJiraProjects(Array.isArray(context.projects) ? context.projects : []);
        if (context.selectedProject) {
          setSelectedProjectKey((current) => current || context.selectedProject);
        }
      } else {
        setJiraState("disconnected");
      }
    } catch {
      const cached = getCachedJiraConnectionContext();
      if (!cached?.connected) setJiraState("disconnected");
    }
  }

  async function loadTeam() {
    try {
      const data = await getProjectTeam(projectId);
      setTeamData(data);
    } catch { /* non-critical */ }
  }

  async function restoreFromWorkflow(id) {
    try {
      const wf = await getWorkflow(id);
      const payload = wf.state_payload ?? {};
      // Seed the accumulator so future PATCHes don't drop previously stored keys
      statePayloadRef.current = { ...payload };
      const analysisData  = payload.backlog_refinement_analysis ?? null;
      const sourcePayload = payload.backlog_refinement_source   ?? null;

      if (analysisData?.generate || analysisData?.refine || analysisData?.slice || analysisData?.ready) {
        applyAnalysis(analysisData);
        setPhase(wf.current_step === "done" ? "done" : "review");
      } else if (sourcePayload?.jira_project_key) {
        setSelectedProjectKey(sourcePayload.jira_project_key);
      }
    } catch {
      // The saved workflow may have been deleted from the DB. Clear the stale
      // pointer so the page can behave like a fresh run instead of surfacing a
      // confusing restore error state forever.
      setWorkflowId(null);
      statePayloadRef.current = {};
      storeCurrentWorkflowId(null);
      sessionStorage.removeItem(BACKLOG_REFINEMENT_RESTORE_KEY);
    }
  }

  // ── Source step ─────────────────────────────────────────────────────────────
  async function handleLoadSource() {
    if (!selectedProjectKey.trim()) return;
    setLoadingSource(true);
    setSourceError(null);
    setSourceData(null);
    try {
      const data = await getBacklogRefinementSource(projectId, selectedProjectKey.trim());
      setSourceData(data);
    } catch (e) {
      setSourceError(e.message);
    } finally {
      setLoadingSource(false);
    }
  }

  // ── Start analysis job ───────────────────────────────────────────────────────
  async function handleRunAnalysis() {
    if (!selectedProjectKey || !sourceData) return;
    setError(null);
    setPhase("running");
    setProgress({ message: "Creating workflow run…", pct: 5 });

    try {
      let wfId = workflowId;
      if (!wfId) {
        const wf = await createWorkflow({
          workflow_type: "backlog_refinement",
          workflow_definition_key: "backlog_refinement",
          workflow_definition_label: "Backlog Refinement",
          project_id: projectId,
          current_step: "source",
          status: "active",
        });
        wfId = wf.id ?? wf.workflow_id;
        storeCurrentWorkflowId(wfId);
        sessionStorage.setItem(BACKLOG_REFINEMENT_RESTORE_KEY, "true");
        setWorkflowId(wfId);
      }

      statePayloadRef.current = {
        ...statePayloadRef.current,
        backlog_refinement_source: {
          jira_project_key: selectedProjectKey,
          total_story_points: sourceData.total_story_points,
        },
      };
      await updateWorkflow(wfId, {
        current_step: "source",
        state_payload: statePayloadRef.current,
      });

      setProgress({ message: "Routing stories through AI analysis…", pct: 15 });

      const jobRes = await startBacklogRefinementAnalysisJob({
        project_id: projectId,
        workflow_id: wfId,
        jira_project_key: selectedProjectKey,
      });

      const jobId = jobRes.job?.id ?? jobRes.job_id;
      if (!jobId) throw new Error("No job ID returned from server");

      setProgress({ message: "Evaluating story quality and routing…", pct: 22 });

      const ws = openJobSocket(jobId);
      socketRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg  = JSON.parse(evt.data);
          const job  = msg.job ?? msg;
          if (job.status === "completed" && job.result_payload) {
            ws.close();
            applyAnalysis(job.result_payload);
            persistAnalysis(wfId, job.result_payload);
            setPhase("review");
          } else if (job.status === "failed") {
            ws.close();
            setError(job.error_message ?? "Analysis failed");
            setPhase("source");
          } else if (job.progress_message) {
            setProgress(p => ({ message: job.progress_message, pct: Math.min((p.pct ?? 22) + 10, 88) }));
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = () => {
        ws.close();
        pollJob(jobId, wfId);
      };

    } catch (e) {
      setError(e.message);
      setPhase("source");
    }
  }

  async function pollJob(jobId, wfId) {
    let attempts = 0;
    const MAX = 60;
    const poll = async () => {
      if (attempts++ >= MAX) {
        setError("Analysis timed out. Please try again.");
        setPhase("source");
        return;
      }
      try {
        const { getGenerationJob } = await import("../api/agents");
        const job = await getGenerationJob(jobId);
        if (job.status === "completed" && job.result_payload) {
          applyAnalysis(job.result_payload);
          persistAnalysis(wfId, job.result_payload);
          setPhase("review");
        } else if (job.status === "failed") {
          setError(job.error_message ?? "Analysis failed");
          setPhase("source");
        } else {
          if (job.progress_message) setProgress(p => ({ message: job.progress_message, pct: Math.min((p.pct ?? 22) + 6, 88) }));
          setTimeout(poll, 3000);
        }
      } catch { setTimeout(poll, 5000); }
    };
    setTimeout(poll, 3000);
  }

  function applyAnalysis(res) {
    const analysis = {
      generate: res.generate ?? [],
      refine:   res.refine   ?? [],
      slice:    res.slice    ?? [],
      ready:    res.ready    ?? [],
      health:   res.health   ?? null,
      summary:  res.summary  ?? null,
    };
    setAnalysis(analysis);
    // All items approved by default
    const approved = {};
    BUCKET_KEYS.forEach(key => {
      approved[key] = new Set(analysis[key].map(getStoryId).filter(Boolean));
    });
    setApprovedSets(approved);
  }

  async function persistAnalysis(wfId, res) {
    try {
      statePayloadRef.current = {
        ...statePayloadRef.current,
        backlog_refinement_analysis: res,
      };
      await updateWorkflow(wfId, {
        current_step: "review",
        state_payload: statePayloadRef.current,
      });
    } catch { /* non-critical */ }
  }

  // ── Approval toggling ────────────────────────────────────────────────────────
  function toggleItem(bucketKey, storyId) {
    if (!storyId) return;
    setApprovedSets(prev => {
      const next = { ...prev };
      const set  = new Set(prev[bucketKey]);
      if (set.has(storyId)) set.delete(storyId);
      else set.add(storyId);
      next[bucketKey] = set;
      return next;
    });
  }

  // ── Execute (async job) ──────────────────────────────────────────────────────
  async function handleExecute() {
    if (!analysis || !approvedSets) return;
    setError(null);
    setPhase("executing");
    setProgress({ message: "Queuing execution job…", pct: 5 });

    try {
      const approvedIssueKeys = (key) =>
        analysis[key]
          .filter(s => approvedSets[key]?.has(getStoryId(s)))
          .map(s => s.issue_key ?? s.key ?? s.id)
          .filter(Boolean);

      const body = {
        project_id:          projectId,
        workflow_id:         workflowId,
        jira_project_key:    selectedProjectKey,
        generate_issue_keys: approvedIssueKeys("generate"),
        refine_issue_keys:   approvedIssueKeys("refine"),
        slice_issue_keys:    approvedIssueKeys("slice"),
      };

      const jobRes = await startBacklogRefinementExecutionJob(body);
      const jobId  = jobRes.job?.id ?? jobRes.job_id;
      if (!jobId) throw new Error("No job ID returned from execution job");

      setProgress({ message: "Executing refinement plan…", pct: 20 });

      const ws = openJobSocket(jobId);
      socketRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const job = msg.job ?? msg;
          if (job.status === "completed") {
            ws.close();
            const result = job.result_payload ?? {};
            applyExecutionResult(result);
          } else if (job.status === "failed") {
            ws.close();
            setError(job.error_message ?? "Execution job failed");
            setPhase("review");
          } else if (job.progress_message) {
            setProgress(p => ({ message: job.progress_message, pct: Math.min((p.pct ?? 20) + 10, 88) }));
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = () => {
        ws.close();
        pollExecutionJob(jobId);
      };

    } catch (e) {
      setError(e.message);
      setPhase("review");
    }
  }

  async function pollExecutionJob(jobId) {
    let attempts = 0;
    const MAX = 60;
    const poll = async () => {
      if (attempts++ >= MAX) {
        setError("Execution timed out. Please try again.");
        setPhase("review");
        return;
      }
      try {
        const job = await getGenerationJob(jobId);
        if (job.status === "completed") {
          applyExecutionResult(job.result_payload ?? {});
        } else if (job.status === "failed") {
          setError(job.error_message ?? "Execution job failed");
          setPhase("review");
        } else {
          if (job.progress_message) setProgress(p => ({ message: job.progress_message, pct: Math.min((p.pct ?? 20) + 6, 88) }));
          setTimeout(poll, 3000);
        }
      } catch { setTimeout(poll, 5000); }
    };
    setTimeout(poll, 3000);
  }

  async function applyExecutionResult(result) {
    setExecResult(result);
    if (workflowId) {
      statePayloadRef.current = {
        ...statePayloadRef.current,
        backlog_refinement_execution: result,
      };
      await updateWorkflow(workflowId, {
        current_step: "done",
        status: "completed",
        state_payload: statePayloadRef.current,
      }).catch(() => {});
    }
    setPhase("done");
  }

  // ── Guards ───────────────────────────────────────────────────────────────────
  if (!projectId) {
    return (
      <div className="px-8 py-8 flex flex-col items-center justify-center gap-4 min-h-[60vh]">
        <div className="w-16 h-16 rounded-2xl bg-surface-container border border-outline flex items-center justify-center">
          <span className="material-symbols-outlined text-[30px] text-on-surface-variant/40">category</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-on-surface mb-1">No project selected</p>
          <p className="text-[12px] text-on-surface-variant">Open a project to run Backlog Refinement.</p>
        </div>
        <button onClick={() => onNavigate?.("projects")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dim transition-all">
          <span className="material-symbols-outlined text-[16px]">folder_open</span>
          Open a Project
        </button>
      </div>
    );
  }

  const velocity     = teamData?.average_velocity_per_sprint ?? null;
  const backlogTarget = teamData?.minimum_ready_backlog_target ?? (velocity ? velocity * 2 : null);

  // Counts for bottom CTA
  const totalApproved = approvedSets
    ? BUCKET_KEYS.reduce((sum, k) => sum + (approvedSets[k]?.size ?? 0), 0)
    : 0;

  return (
    <>
      {/* Inject keyframe animations */}
      <style>{ANIM_CSS}</style>

      <div className="px-8 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => onNavigate?.("project-detail")}
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            {project?.name ?? "Project"}
          </button>
          <span className="text-on-surface-variant">·</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center">
              <span className="material-symbols-outlined text-[13px] text-indigo-600" style={{ fontVariationSettings: "'FILL' 1" }}>category</span>
            </div>
            <h2 className="text-base font-headline font-bold text-on-surface">Backlog Refinement</h2>
          </div>
        </div>

        <FlowBar current={
          phase === "running"    ? "analyze" :
          phase === "executing"  ? "done"    :
          phase
        } />

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
            <span className="material-symbols-outlined text-error text-[18px]">error</span>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-xs font-semibold text-red-600 shrink-0">Dismiss</button>
          </div>
        )}

        {/* ── SOURCE ── */}
        {phase === "source" && (
          <div className="grid grid-cols-[5fr_7fr] gap-8 items-start">

            {/* ── Left: form ── */}
            <div className="space-y-6">

              {/* Jira not connected */}
              {jiraState === "disconnected" && (
                <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-500 text-[20px] shrink-0">warning</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Jira not connected</p>
                    <p className="text-[12px] text-amber-700 mt-0.5">Connect Jira in Connectors to load your backlog.</p>
                  </div>
                  <button
                    onClick={() => onNavigate?.("connectors")}
                    className="ml-auto shrink-0 flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-[11px] font-bold rounded-lg hover:bg-amber-600 transition-all"
                  >
                    Go to Connectors
                  </button>
                </div>
              )}

              {/* Project picker */}
              {jiraState === "connected" && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                      Jira Project
                    </label>
                    <div className="flex items-center gap-3">
                      {jiraProjects.length > 0 ? (
                        <select
                          value={selectedProjectKey}
                          onChange={(e) => { setSelectedProjectKey(e.target.value); setSourceData(null); }}
                          className="flex-1 px-3 py-2.5 bg-surface border border-outline rounded-xl text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        >
                          <option value="">Select a project…</option>
                          {jiraProjects.map(p => (
                            <option key={p.key ?? p.id} value={p.key ?? p.id}>
                              {p.name} {p.key ? `(${p.key})` : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Project key (e.g. PROD)"
                          value={selectedProjectKey}
                          onChange={(e) => { setSelectedProjectKey(e.target.value.toUpperCase()); setSourceData(null); }}
                          className="flex-1 px-3 py-2.5 bg-surface border border-outline rounded-xl text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      )}
                      <button
                        onClick={handleLoadSource}
                        disabled={!selectedProjectKey || loadingSource}
                        className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-outline rounded-xl text-sm font-bold text-on-surface hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {loadingSource
                          ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                          : <span className="material-symbols-outlined text-[16px]">cloud_download</span>
                        }
                        Load
                      </button>
                    </div>
                    {sourceError && (
                      <p className="mt-2 text-[11px] text-error">{sourceError}</p>
                    )}
                  </div>

                  {/* Source stats — appear after load */}
                  {sourceData ? (
                    <div className="space-y-4" style={{ animation: "bucketItemIn 0.4s ease both" }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Backlog Snapshot</p>
                      <div className="grid grid-cols-3 gap-3">
                        <StatChip
                          icon="receipt_long"
                          label="Total Points"
                          value={sourceData.total_story_points ?? "—"}
                          accent={{ bg: "bg-primary/10", text: "text-primary" }}
                        />
                        <StatChip
                          icon="speed"
                          label="Velocity"
                          value={velocity ?? "—"}
                          accent={{ bg: "bg-teal-100", text: "text-teal-700" }}
                        />
                        <StatChip
                          icon="target"
                          label="Floor"
                          value={backlogTarget ?? "—"}
                          accent={{ bg: "bg-blue-100", text: "text-blue-700" }}
                        />
                      </div>
                      {(sourceData.features?.length > 0 || sourceData.stories?.length > 0) && (
                        <div className="flex items-center gap-4 text-[12px] text-on-surface-variant">
                          {sourceData.features?.length > 0 && (
                            <span><strong className="text-on-surface">{sourceData.features.length}</strong> epics</span>
                          )}
                          {sourceData.stories?.length > 0 && (
                            <span><strong className="text-on-surface">{sourceData.stories.length}</strong> stories</span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Placeholder stat skeletons while nothing loaded yet */
                    <div className="grid grid-cols-3 gap-3 opacity-30 pointer-events-none">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-surface-container rounded-xl border border-outline" />
                      ))}
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    onClick={handleRunAnalysis}
                    disabled={!sourceData}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dim disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm text-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">analytics</span>
                    Run Analysis
                  </button>
                </>
              )}

              {jiraState === "checking" && (
                <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  Checking Jira connection…
                </div>
              )}
            </div>

            {/* ── Right: routing rules explainer ── */}
            <div className="rounded-2xl border border-outline bg-surface overflow-hidden">
              <div className="px-6 py-5 border-b border-outline bg-surface-container/40">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">How routing works</p>
                <p className="text-[12px] text-on-surface-variant">Each story and feature is automatically placed into one of four buckets based on these rules. You review and approve before anything runs.</p>
              </div>
              <div className="divide-y divide-outline">
                {BUCKET_KEYS.map((key) => {
                  const cfg = BUCKET_CFG[key];
                  return (
                    <div key={key} className="flex items-center gap-4 px-6 py-4">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${cfg.headerFrom}18` }}
                      >
                        <span
                          className="material-symbols-outlined text-[18px]"
                          style={{ color: cfg.leftBar, fontVariationSettings: "'FILL' 1" }}
                        >
                          {cfg.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface">{cfg.label}</p>
                        <p className="text-[12px] text-on-surface-variant mt-0.5">{cfg.desc}</p>
                      </div>
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cfg.leftBar }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="px-6 py-4 border-t border-outline bg-surface-container/20">
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Analysis runs each story through the <span className="font-semibold text-on-surface">Story Refiner</span> skill — routing is not a shallow structural pass. <span className="font-semibold text-on-surface">Ready</span> means the story passed quality evaluation and is ≤8 points. <span className="font-semibold text-on-surface">Refine</span> catches quality failures. <span className="font-semibold text-on-surface">Slice</span> catches oversized stories. <span className="font-semibold text-on-surface">Generate</span> fills coverage gaps.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ── RUNNING (analysis job) ── */}
        {phase === "running" && (
          <AnalysisProgress message={progress.message} pct={progress.pct} />
        )}

        {/* ── EXECUTING (execution job) ── */}
        {phase === "executing" && (
          <div className="flex flex-col items-center justify-center py-24 gap-8">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[36px] text-emerald-600"
                  style={{ fontVariationSettings: "'FILL' 1", animation: "routingPulse 2s ease-in-out infinite" }}
                >
                  check_circle
                </span>
              </div>
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500"
                  style={{
                    top: "50%", left: "50%",
                    transform: `rotate(${i * 120}deg) translate(38px) translate(-50%, -50%)`,
                    animation: `routingPulse 1.6s ease-in-out ${i * 0.5}s infinite`,
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
            <div className="text-center">
              <p className="text-lg font-headline font-bold text-on-surface mb-1">Saving your plan…</p>
              <p className="text-[13px] text-on-surface-variant max-w-xs leading-relaxed">{progress.message}</p>
            </div>
            <div className="w-80">
              <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              <p className="text-[11px] text-on-surface-variant/60 text-center mt-2">{progress.pct}%</p>
            </div>
          </div>
        )}

        {/* ── REVIEW ── */}
        {phase === "review" && analysis && approvedSets && (
          <>
            <HealthPanel health={analysis.health} summary={analysis.summary} />

            {/* Bucket grid */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              {BUCKET_KEYS.map((key, i) => (
                <BucketColumn
                  key={key}
                  bucketKey={key}
                  items={analysis[key]}
                  approvedSet={approvedSets[key]}
                  onToggle={toggleItem}
                  colIndex={i}
                />
              ))}
            </div>

            {/* Approve CTA */}
            <div className="flex items-center justify-between p-5 bg-surface border border-outline rounded-2xl shadow-card">
              <div>
                <p className="text-sm font-headline font-bold text-on-surface">Approve Routing Plan</p>
                <p className="text-[12px] text-on-surface-variant mt-0.5">
                  {totalApproved} item{totalApproved !== 1 ? "s" : ""} approved · nothing runs until you confirm
                </p>
              </div>
              <button
                onClick={handleExecute}
                disabled={totalApproved === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dim disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm text-sm"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Approve Plan
              </button>
            </div>
          </>
        )}

        {/* ── DONE ── */}
        {phase === "done" && (
          <ExecutionResults
            execResult={execResult}
            onBack={() => onNavigate?.("project-detail")}
            onRunAgain={() => {
              setPhase("source");
              setAnalysis(null);
              setApprovedSets(null);
              setSourceData(null);
              setExecResult(null);
              setWorkflowId(null);
              statePayloadRef.current = {};
              storeCurrentWorkflowId(null);
              sessionStorage.removeItem(BACKLOG_REFINEMENT_RESTORE_KEY);
            }}
          />
        )}

      </div>
    </>
  );
}
