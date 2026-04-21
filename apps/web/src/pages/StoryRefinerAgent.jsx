import { useState, useRef, useEffect } from "react";
import { openJobSocket } from "../api/jobs";
import { startStoryRefinementJob } from "../api/agents";
import { getSkills } from "../api/skills";
import { getProjectStories } from "../api/projectStories";

const MAX_STORIES = 8;

const PRIORITY_CFG = {
  high:   "bg-red-50 text-red-600 border-red-100",
  medium: "bg-amber-50 text-amber-600 border-amber-100",
  low:    "bg-slate-100 text-slate-500 border-slate-200",
};

// ─── Refined story card ───────────────────────────────────────────────────────
function RefinedStoryCard({ result, index }) {
  const story      = result.refined ?? result.story ?? result;
  const evaluation = result.evaluation ?? null;
  const score      = evaluation?.overall_score ?? null;
  const gaps       = evaluation?.gaps ?? [];
  const strengths  = evaluation?.strengths ?? [];
  const priorityCls = PRIORITY_CFG[story.priority ?? "medium"] ?? PRIORITY_CFG.medium;
  const [expanded, setExpanded] = useState(false);
  const hasEval = gaps.length > 0 || strengths.length > 0;

  return (
    <div className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-blue-50 border-b border-blue-100">
        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
          <span className="text-[10px] font-black text-white leading-none">{index + 1}</span>
        </div>
        <h4 className="text-sm font-headline font-bold text-on-surface flex-1 leading-snug">{story.title}</h4>
        <div className="flex items-center gap-2 shrink-0">
          {score != null && (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {typeof score === "number" ? score.toFixed(1) : score}
            </span>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityCls}`}>
            {story.priority ?? "medium"}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* User story */}
        {(story.as_a || story.i_want || story.so_that || story.user_story) && (
          <div className="bg-surface-container border border-outline rounded-xl px-4 py-3 space-y-1.5">
            {(story.as_a || story.i_want || story.so_that) ? (
              <>
                <p className="text-[12px] text-on-surface-variant leading-relaxed">
                  <span className="font-semibold text-on-surface">As a</span> {story.as_a}
                </p>
                <p className="text-[12px] text-on-surface-variant leading-relaxed">
                  <span className="font-semibold text-on-surface">I want</span> {story.i_want}
                </p>
                <p className="text-[12px] text-on-surface-variant leading-relaxed">
                  <span className="font-semibold text-on-surface">So that</span> {story.so_that}
                </p>
              </>
            ) : (
              <p className="text-[12px] text-on-surface-variant italic leading-relaxed">{story.user_story}</p>
            )}
          </div>
        )}

        {/* Acceptance criteria */}
        {story.acceptance_criteria?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              Acceptance Criteria
            </p>
            <ul className="space-y-1.5">
              {story.acceptance_criteria.map((crit, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[12px] text-on-surface-variant">
                  <span
                    className="material-symbols-outlined text-[13px] text-primary mt-0.5 shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  {crit}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Evaluation details (expandable) */}
        {hasEval && (
          <>
            {expanded && (
              <div className="space-y-3 pt-2 border-t border-outline/60">
                {strengths.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Strengths</p>
                    <ul className="space-y-1">
                      {strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                          <span className="material-symbols-outlined text-[13px] text-emerald-500 mt-0.5 shrink-0">thumb_up</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {gaps.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Gaps Addressed</p>
                    <ul className="space-y-1">
                      {gaps.map((g, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                          <span className="material-symbols-outlined text-[13px] text-amber-500 mt-0.5 shrink-0">build_circle</span>
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary-dim transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">
                {expanded ? "expand_less" : "expand_more"}
              </span>
              {expanded ? "Hide evaluation" : "Show evaluation details"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tag input ────────────────────────────────────────────────────────────────
function TagInput({ label, hint, tags, onAdd, onRemove }) {
  const [input, setInput] = useState("");
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
              <button type="button" onClick={() => onRemove(i)} className="hover:text-red-500 transition-colors ml-0.5">
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
        onKeyDown={(e) => {
          if (e.key === "Enter" && input.trim()) {
            e.preventDefault();
            onAdd(input.trim());
            setInput("");
          }
        }}
        placeholder={hint}
        className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 transition"
      />
      <p className="text-[10px] text-on-surface-variant mt-1">Press Enter to add</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StoryRefinerAgent({ project, onNavigate }) {
  const [phase, setPhase]                     = useState("form");
  const [stories, setStories]                 = useState([]);
  const [storiesLoading, setStoriesLoading]   = useState(true);
  const [selectedIds, setSelectedIds]         = useState(new Set());
  const [refinementGoal, setRefinementGoal]   = useState("");
  const [constraints, setConstraints]         = useState([]);
  const [supportingCtx, setSupportingCtx]     = useState([]);
  const [jobMessage, setJobMessage]           = useState(null);
  const [refinedResults, setRefinedResults]   = useState([]);
  const [refinementSummary, setRefinementSummary] = useState("");
  const [refinerSkill, setRefinerSkill]       = useState(null);
  const [error, setError]                     = useState(null);
  const wsRef = useRef(null);

  useEffect(() => () => wsRef.current?.close(), []);

  // Load project stories
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    getProjectStories(project.id)
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : (data.stories ?? []);
        setStories(rows);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setStoriesLoading(false); });
    return () => { cancelled = true; };
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load active story_refinement skill
  useEffect(() => {
    let cancelled = false;
    getSkills("story_refinement", true)
      .then((result) => {
        if (cancelled) return;
        const rows = Array.isArray(result) ? result : (result.skills ?? []);
        setRefinerSkill(rows[0] ?? null);
      })
      .catch(() => { if (!cancelled) setRefinerSkill(null); });
    return () => { cancelled = true; };
  }, []);

  function toggleStory(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_STORIES) {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(stories.slice(0, MAX_STORIES).map((s) => s.id ?? s.story_id)));
    }
  }

  function connectSocket(jobId) {
    wsRef.current?.close();
    const ws = openJobSocket(jobId);
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
        setError(job.error_message ?? "Story refinement failed. Please retry.");
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
    // Backend may return { results: [{refined, evaluation}], summary }
    // or { stories: [...] }
    const results = payload?.results
      ?? (payload?.stories ?? []).map((s) => ({ refined: s }));
    setRefinedResults(Array.isArray(results) ? results : []);
    setRefinementSummary(payload?.summary ?? payload?.refinement_summary ?? "");
    setPhase("result");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (selectedIds.size === 0) return;
    setError(null);
    setPhase("running");
    setJobMessage("Initialising story refinement...");
    try {
      const body = {
        project_id:  project.id,
        source_type: "project_story",
        story_ids:   Array.from(selectedIds),
        ...(refinementGoal      ? { refinement_goal:   refinementGoal }   : {}),
        ...(constraints.length  ? { constraints }                          : {}),
        ...(supportingCtx.length ? { supporting_context: supportingCtx }  : {}),
      };
      const result = await startStoryRefinementJob(body);
      const id = result.job?.id;
      if (!id) throw new Error("No job ID returned from server.");
      setJobMessage(result.job.progress_message ?? "Refining stories...");
      connectSocket(id);
    } catch (err) {
      setError(err.message);
      setPhase("form");
    }
  }

  function handleReset() {
    wsRef.current?.close();
    setPhase("form");
    setRefinedResults([]);
    setError(null);
    setJobMessage(null);
    setRefinementSummary("");
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
            <span
              className="material-symbols-outlined text-[22px] text-white"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_fix_high
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              Story Refiner
            </p>
            <h2 className="text-2xl font-headline font-bold text-on-surface">{subtitle}</h2>
          </div>
        </div>
      </div>
    );
  }

  // ── Result view ───────────────────────────────────────────────────────────
  if (phase === "result") {
    return (
      <div className="px-10 py-10">
        <button
          onClick={() => onNavigate?.("project-detail", project)}
          className="flex items-center gap-1 text-[12px] font-semibold text-on-surface-variant hover:text-primary transition-colors mb-6"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          Back to Project
        </button>

        <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">

          {/* ── Left panel ── */}
          <div className="xl:sticky xl:top-8 space-y-4">

            {/* Hero */}
            <div className="bg-gradient-to-br from-primary to-blue-700 rounded-2xl p-6 shadow-lg shadow-primary/20">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="material-symbols-outlined text-[18px] text-blue-200"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  auto_fix_high
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200">
                  Story Refiner
                </span>
              </div>
              <p className="text-[40px] font-headline font-black text-white leading-none">{refinedResults.length}</p>
              <p className="text-[13px] text-blue-100/80 mt-1">
                {refinedResults.length === 1 ? "story refined" : "stories refined"}
              </p>
            </div>

            {/* Meta */}
            <div className="bg-surface border border-outline rounded-2xl p-5 shadow-card space-y-4">
              {project && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant">inventory_2</span>
                  <span className="text-[11px] text-on-surface-variant">Project</span>
                  <span className="text-[11px] font-bold text-on-surface truncate">{project.name}</span>
                </div>
              )}
              {refinerSkill && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-primary">psychology</span>
                  <span className="text-[11px] text-on-surface-variant">Skill</span>
                  <span className="text-[11px] font-bold text-on-surface truncate">{refinerSkill.name}</span>
                </div>
              )}
              {refinementSummary && (
                <div className="border-t border-outline pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Refinement Summary</p>
                  <p className="text-[12px] text-on-surface-variant leading-relaxed">{refinementSummary}</p>
                </div>
              )}
            </div>

            {/* Run again */}
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface border border-outline text-on-surface text-sm font-bold rounded-xl hover:border-primary hover:text-primary transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Refine Again
            </button>
          </div>

          {/* ── Refined story list ── */}
          <div className="space-y-4">
            {refinedResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed border-outline rounded-2xl">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant">auto_fix_high</span>
                <p className="text-sm text-on-surface-variant">No results returned. Try running again.</p>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline rounded-lg text-sm font-semibold hover:border-primary hover:text-primary transition-all"
                >
                  <span className="material-symbols-outlined text-[15px]">refresh</span>
                  Run Again
                </button>
              </div>
            ) : (
              refinedResults.map((result, i) => (
                <RefinedStoryCard key={result.story_id ?? result.refined?.id ?? i} result={result} index={i} />
              ))
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
        <PageHeader subtitle="Refining..." />
        <div className="bg-surface border border-outline rounded-2xl p-12 shadow-card flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-20 h-20 rounded-full bg-blue-100 animate-ping opacity-40" />
            <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center shadow-sm z-10">
              <span
                className="material-symbols-outlined text-[28px] text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_fix_high
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-on-surface">{jobMessage ?? "Refining stories..."}</p>
            <p className="text-[12px] text-on-surface-variant mt-1.5">This usually takes 15–45 seconds</p>
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-blue-300 via-primary to-blue-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ─────────────────────────────────────────────────────────────
  return (
    <div className="px-10 py-10 max-w-2xl">
      <PageHeader subtitle="Refine Stories" />

      {/* Project context */}
      {project && (
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-container border border-outline rounded-xl mb-4">
          <span className="material-symbols-outlined text-[15px] text-on-surface-variant">inventory_2</span>
          <span className="text-[12px] text-on-surface-variant">Running under</span>
          <span className="text-[12px] font-bold text-on-surface">{project.name}</span>
        </div>
      )}

      {/* Skill badge */}
      {refinerSkill && (
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-[15px] text-primary">psychology</span>
          <span className="text-[12px] text-blue-700">Using Story Refinement Skill</span>
          <span className="text-[12px] font-bold text-blue-900">{refinerSkill.name}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-error text-[16px]">error</span>
          <p className="text-sm text-red-700 flex-1">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Story selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Select Stories to Refine
              <span className="normal-case font-normal tracking-normal ml-1">(max {MAX_STORIES})</span>
            </label>
            {stories.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11px] font-semibold text-primary hover:text-primary-dim transition-colors"
              >
                {selectedIds.size > 0 ? "Deselect all" : `Select first ${Math.min(stories.length, MAX_STORIES)}`}
              </button>
            )}
          </div>

          {storiesLoading ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-container border border-outline rounded-lg">
              <span className="w-3.5 h-3.5 border-2 border-outline border-t-primary rounded-full animate-spin shrink-0" />
              <span className="text-sm text-on-surface-variant">Loading stories...</span>
            </div>
          ) : stories.length === 0 ? (
            <div className="px-4 py-4 bg-surface-container border border-outline rounded-xl space-y-1">
              <p className="text-sm font-semibold text-on-surface">No stories found for this project.</p>
              <p className="text-[12px] text-on-surface-variant">
                Generate stories first using the Story Generator agent, then come back here.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto border border-outline rounded-xl p-3 bg-surface-container">
              {stories.map((story) => {
                const id = story.id ?? story.story_id;
                const checked = selectedIds.has(id);
                const atCap = !checked && selectedIds.size >= MAX_STORIES;
                return (
                  <label
                    key={id}
                    className={[
                      "flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      atCap
                        ? "opacity-40 cursor-not-allowed border border-transparent"
                        : checked
                          ? "bg-primary/5 border border-primary/20 cursor-pointer"
                          : "hover:bg-surface-dim border border-transparent cursor-pointer",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 shrink-0 accent-primary"
                      checked={checked}
                      disabled={atCap}
                      onChange={() => toggleStory(id)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface leading-snug">{story.title}</p>
                      {(story.user_story || story.as_a) && (
                        <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-1">
                          {story.user_story ?? `As a ${story.as_a}...`}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {selectedIds.size > 0 && (
            <p className={`text-[11px] font-semibold mt-1.5 ${selectedIds.size >= MAX_STORIES ? "text-amber-600" : "text-primary"}`}>
              {selectedIds.size} {selectedIds.size === 1 ? "story" : "stories"} selected
              {selectedIds.size >= MAX_STORIES && " — limit reached"}
            </p>
          )}
        </div>

        {/* Refinement goal */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Refinement Goal <span className="normal-case font-normal tracking-normal">(optional)</span>
          </label>
          <textarea
            value={refinementGoal}
            onChange={(e) => setRefinementGoal(e.target.value)}
            rows={3}
            placeholder='e.g. "Improve acceptance criteria clarity and ensure stories are independently deliverable"'
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 transition resize-none"
          />
        </div>

        <TagInput
          label="Constraints"
          hint='e.g. "Keep each story under 3 acceptance criteria" — press Enter to add'
          tags={constraints}
          onAdd={(t) => setConstraints((p) => [...p, t])}
          onRemove={(i) => setConstraints((p) => p.filter((_, idx) => idx !== i))}
        />

        <TagInput
          label="Supporting Context"
          hint='e.g. "Align with Q2 mobile redesign scope" — press Enter to add'
          tags={supportingCtx}
          onAdd={(t) => setSupportingCtx((p) => [...p, t])}
          onRemove={(i) => setSupportingCtx((p) => p.filter((_, idx) => idx !== i))}
        />

        <div className="pt-2">
          <button
            type="submit"
            disabled={selectedIds.size === 0 || storiesLoading || stories.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-blue-600 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all shadow-sm shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_fix_high
            </span>
            {selectedIds.size > 0
              ? `Refine ${selectedIds.size} ${selectedIds.size === 1 ? "Story" : "Stories"}`
              : "Refine Stories"}
          </button>
        </div>

      </form>
    </div>
  );
}
