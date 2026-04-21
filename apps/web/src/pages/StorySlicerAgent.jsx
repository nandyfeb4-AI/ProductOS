import { useState, useRef, useEffect } from "react";
import { openJobSocket } from "../api/jobs";
import { startStorySlicingAgentJob } from "../api/agents";
import { getSkills } from "../api/skills";
import { getProjectStories } from "../api/projectStories";

const STORY_SLICER_SOURCE_KEY = "story_slicer_source_story_id";

const PRIORITY_CFG = {
  high:   "bg-red-50 text-red-600 border-red-100",
  medium: "bg-amber-50 text-amber-600 border-amber-100",
  low:    "bg-slate-100 text-slate-500 border-slate-200",
};

// ─── Story card (source or child) ────────────────────────────────────────────
function StoryCard({ story, index, variant = "child" }) {
  const priorityCls = PRIORITY_CFG[story.priority ?? "medium"] ?? PRIORITY_CFG.medium;
  const isSource = variant === "source";

  return (
    <div className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-card">
      <div className={[
        "flex items-center gap-3 px-5 py-3.5 border-b",
        isSource
          ? "bg-slate-100 border-slate-200"
          : "bg-amber-50 border-amber-100",
      ].join(" ")}>
        {isSource ? (
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2 py-0.5 rounded-full border border-slate-300 bg-white shrink-0">
            Source
          </span>
        ) : (
          <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-black text-white leading-none">{index + 1}</span>
          </div>
        )}
        <h4 className="text-sm font-headline font-bold text-on-surface flex-1 leading-snug">{story.title}</h4>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${priorityCls}`}>
          {story.priority ?? "medium"}
        </span>
      </div>

      <div className="p-5 space-y-4">
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

        {story.acceptance_criteria?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              Acceptance Criteria
            </p>
            <ul className="space-y-1.5">
              {story.acceptance_criteria.map((crit, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[12px] text-on-surface-variant">
                  <span
                    className="material-symbols-outlined text-[13px] text-amber-500 mt-0.5 shrink-0"
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
              className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-[11px] font-semibold rounded-full border border-amber-200"
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
        className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 placeholder:text-on-surface-variant/40 transition"
      />
      <p className="text-[10px] text-on-surface-variant mt-1">Press Enter to add</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StorySlicerAgent({ project, onNavigate }) {
  const [phase, setPhase]                       = useState("form");
  const [stories, setStories]                   = useState([]);
  const [storiesLoading, setStoriesLoading]     = useState(true);
  const [selectedStoryId, setSelectedStoryId]   = useState("");
  const [countHint, setCountHint]               = useState("");
  const [constraints, setConstraints]           = useState([]);
  const [supportingCtx, setSupportingCtx]       = useState([]);
  const [jobMessage, setJobMessage]             = useState(null);
  const [sourceStory, setSourceStory]           = useState(null);
  const [childStories, setChildStories]         = useState([]);
  const [slicingSummary, setSlicingSummary]     = useState("");
  const [slicingSkill, setSlicingSkill]         = useState(null);
  const [error, setError]                       = useState(null);
  const wsRef = useRef(null);

  useEffect(() => () => wsRef.current?.close(), []);

  // Load project stories, honour pre-selected story from sessionStorage
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    getProjectStories(project.id)
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : (data.stories ?? []);
        setStories(rows);
        let preselect = "";
        try { preselect = sessionStorage.getItem(STORY_SLICER_SOURCE_KEY) ?? ""; } catch {}
        if (preselect && rows.some((s) => (s.id ?? s.story_id) === preselect)) {
          setSelectedStoryId(preselect);
          try { sessionStorage.removeItem(STORY_SLICER_SOURCE_KEY); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setStoriesLoading(false); });
    return () => { cancelled = true; };
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load active story_slicing skill
  useEffect(() => {
    let cancelled = false;
    getSkills("story_slicing", true)
      .then((result) => {
        if (cancelled) return;
        const rows = Array.isArray(result) ? result : (result.skills ?? []);
        setSlicingSkill(rows[0] ?? null);
      })
      .catch(() => { if (!cancelled) setSlicingSkill(null); });
    return () => { cancelled = true; };
  }, []);

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
        setError(job.error_message ?? "Story slicing failed. Please retry.");
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
    // Backend returns: { source_story, sliced_stories, slicing_summary }
    // Also handle fallback shapes
    setSourceStory(payload?.source_story ?? payload?.original ?? null);
    const children = payload?.sliced_stories ?? payload?.children ?? payload?.stories ?? [];
    setChildStories(Array.isArray(children) ? children : []);
    setSlicingSummary(payload?.slicing_summary ?? payload?.summary ?? "");
    setPhase("result");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedStoryId) return;
    setError(null);
    setPhase("running");
    setJobMessage("Initialising story slicer...");
    try {
      const body = {
        project_id:      project.id,
        source_type:     "project_story",
        source_story_id: selectedStoryId,
        ...(countHint            ? { target_story_count_hint: parseInt(countHint, 10) } : {}),
        ...(constraints.length   ? { constraints }                                       : {}),
        ...(supportingCtx.length ? { supporting_context: supportingCtx }                 : {}),
      };
      const result = await startStorySlicingAgentJob(body);
      const id = result.job?.id;
      if (!id) throw new Error("No job ID returned from server.");
      setJobMessage(result.job.progress_message ?? "Slicing story...");
      connectSocket(id);
    } catch (err) {
      setError(err.message);
      setPhase("form");
    }
  }

  function handleReset() {
    wsRef.current?.close();
    setPhase("form");
    setSourceStory(null);
    setChildStories([]);
    setError(null);
    setJobMessage(null);
    setSlicingSummary("");
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
            <span
              className="material-symbols-outlined text-[22px] text-white"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              call_split
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              Story Slicer
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
            <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl p-6 shadow-lg shadow-amber-500/20">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="material-symbols-outlined text-[18px] text-amber-200"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  call_split
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200">
                  Story Slicer
                </span>
              </div>
              <p className="text-[40px] font-headline font-black text-white leading-none">{childStories.length}</p>
              <p className="text-[13px] text-amber-100/80 mt-1">
                {childStories.length === 1 ? "child story created" : "child stories created"}
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
              {slicingSkill && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-amber-500">psychology</span>
                  <span className="text-[11px] text-on-surface-variant">Skill</span>
                  <span className="text-[11px] font-bold text-on-surface truncate">{slicingSkill.name}</span>
                </div>
              )}
              {slicingSummary && (
                <div className="border-t border-outline pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Slicing Summary</p>
                  <p className="text-[12px] text-on-surface-variant leading-relaxed">{slicingSummary}</p>
                </div>
              )}
            </div>

            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface border border-outline text-on-surface text-sm font-bold rounded-xl hover:border-amber-400 hover:text-amber-600 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Slice Another Story
            </button>
          </div>

          {/* ── Right: source + children ── */}
          <div className="space-y-6">

            {/* Source story */}
            {sourceStory && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                  Source Story
                </p>
                <StoryCard story={sourceStory} index={0} variant="source" />
              </div>
            )}

            {/* Child stories */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                Sliced Stories
              </p>
              {childStories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 border-2 border-dashed border-outline rounded-2xl">
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant">call_split</span>
                  <p className="text-sm text-on-surface-variant">No child stories returned. Try running again.</p>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline rounded-lg text-sm font-semibold hover:border-amber-400 hover:text-amber-600 transition-all"
                  >
                    <span className="material-symbols-outlined text-[15px]">refresh</span>
                    Run Again
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {childStories.map((story, i) => (
                    <StoryCard key={story.id ?? story.story_id ?? i} story={story} index={i} variant="child" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Running view ──────────────────────────────────────────────────────────
  if (phase === "running") {
    return (
      <div className="px-10 py-10 max-w-xl">
        <PageHeader subtitle="Slicing..." />
        <div className="bg-surface border border-outline rounded-2xl p-12 shadow-card flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-20 h-20 rounded-full bg-amber-100 animate-ping opacity-40" />
            <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-100 flex items-center justify-center shadow-sm z-10">
              <span
                className="material-symbols-outlined text-[28px] text-amber-500"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                call_split
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-on-surface">{jobMessage ?? "Slicing story..."}</p>
            <p className="text-[12px] text-on-surface-variant mt-1.5">This usually takes 15–30 seconds</p>
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-amber-300 via-amber-500 to-amber-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ─────────────────────────────────────────────────────────────
  // Filter out already-sliced stories — they can't be sliced again
  const sliceableStories = stories.filter((s) => s.status !== "sliced");

  return (
    <div className="px-10 py-10 max-w-2xl">
      <PageHeader subtitle="Slice a Story" />

      {/* Project context */}
      {project && (
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-container border border-outline rounded-xl mb-4">
          <span className="material-symbols-outlined text-[15px] text-on-surface-variant">inventory_2</span>
          <span className="text-[12px] text-on-surface-variant">Running under</span>
          <span className="text-[12px] font-bold text-on-surface">{project.name}</span>
        </div>
      )}

      {/* Skill badge */}
      {slicingSkill && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-[15px] text-amber-500">psychology</span>
          <span className="text-[12px] text-amber-700">Using Story Slicing Skill</span>
          <span className="text-[12px] font-bold text-amber-900">{slicingSkill.name}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-error text-[16px]">error</span>
          <p className="text-sm text-red-700 flex-1">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Source story selector */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Source Story
          </label>

          {storiesLoading ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-container border border-outline rounded-lg">
              <span className="w-3.5 h-3.5 border-2 border-outline border-t-amber-500 rounded-full animate-spin shrink-0" />
              <span className="text-sm text-on-surface-variant">Loading stories...</span>
            </div>
          ) : sliceableStories.length === 0 ? (
            <div className="px-4 py-4 bg-surface-container border border-outline rounded-xl space-y-1">
              <p className="text-sm font-semibold text-on-surface">
                {stories.length === 0
                  ? "No stories found for this project."
                  : "All stories have already been sliced."}
              </p>
              <p className="text-[12px] text-on-surface-variant">
                {stories.length === 0
                  ? "Generate stories first using the Story Generator agent, then come back here."
                  : "Generate or refine new stories to create more sliceable candidates."}
              </p>
            </div>
          ) : (
            <select
              value={selectedStoryId}
              onChange={(e) => setSelectedStoryId(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition"
            >
              <option value="">Select a story to slice...</option>
              {sliceableStories.map((s) => {
                const id = s.id ?? s.story_id;
                return <option key={id} value={id}>{s.title || "Untitled Story"}</option>;
              })}
            </select>
          )}

          <p className="text-[10px] text-on-surface-variant mt-1.5">
            The selected story will be kept as the original and marked as sliced. New child stories will be created.
          </p>
        </div>

        {/* Target count hint */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Target Story Count <span className="normal-case font-normal tracking-normal">(optional)</span>
          </label>
          <input
            type="number"
            min="2"
            max="10"
            value={countHint}
            onChange={(e) => setCountHint(e.target.value)}
            placeholder="e.g. 3"
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 placeholder:text-on-surface-variant/40 transition"
          />
          <p className="text-[10px] text-on-surface-variant mt-1">
            How many child stories to aim for. Leave blank to let the agent decide.
          </p>
        </div>

        <TagInput
          label="Constraints"
          hint='e.g. "Each slice must be independently shippable" — press Enter to add'
          tags={constraints}
          onAdd={(t) => setConstraints((p) => [...p, t])}
          onRemove={(i) => setConstraints((p) => p.filter((_, idx) => idx !== i))}
        />

        <TagInput
          label="Supporting Context"
          hint='e.g. "Scoped to mobile web only" — press Enter to add'
          tags={supportingCtx}
          onAdd={(t) => setSupportingCtx((p) => [...p, t])}
          onRemove={(i) => setSupportingCtx((p) => p.filter((_, idx) => idx !== i))}
        />

        <div className="pt-2">
          <button
            type="submit"
            disabled={!selectedStoryId || storiesLoading || sliceableStories.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-bold rounded-xl hover:from-amber-400 hover:to-amber-500 transition-all shadow-sm shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              call_split
            </span>
            Slice Story
          </button>
        </div>

      </form>
    </div>
  );
}
