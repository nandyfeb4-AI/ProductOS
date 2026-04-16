import { useState, useRef, useEffect } from "react";
import { openJobSocket } from "../api/jobs";
import { startStoryGeneratorJob } from "../api/agents";
import { getSkills } from "../api/skills";
import { getProjectFeatures } from "../api/projectFeatures";

const STORY_SOURCE_FEATURE_KEY = "story_generator_source_feature_id";

const PRIORITY_CFG = {
  high:   "bg-red-50 text-red-600 border-red-100",
  medium: "bg-amber-50 text-amber-600 border-amber-100",
  low:    "bg-slate-100 text-slate-500 border-slate-200",
};

// ─── Story card ───────────────────────────────────────────────────────────────
function StoryCard({ story, index }) {
  const [expanded, setExpanded] = useState(false);
  const priorityCls = PRIORITY_CFG[story.priority ?? "medium"] ?? PRIORITY_CFG.medium;
  const hasExtra = (story.edge_cases?.length ?? 0) + (story.dependencies?.length ?? 0) > 0;

  return (
    <div className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-card">
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-emerald-50 border-b border-emerald-100">
        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-black text-white leading-none">{index + 1}</span>
        </div>
        <h4 className="text-sm font-headline font-bold text-on-surface flex-1 leading-snug">{story.title}</h4>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${priorityCls}`}>
          {story.priority ?? "medium"}
        </span>
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

        {/* Description */}
        {story.description && (
          <p className="text-[12px] text-on-surface-variant leading-relaxed">{story.description}</p>
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
                    className="material-symbols-outlined text-[13px] text-emerald-500 mt-0.5 shrink-0"
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

        {/* Expandable: edge cases + dependencies */}
        {hasExtra && expanded && (
          <div className="space-y-4 pt-2 border-t border-outline/60">
            {story.edge_cases?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Edge Cases</p>
                <ul className="space-y-1.5">
                  {story.edge_cases.map((ec, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                      <span className="material-symbols-outlined text-[13px] text-amber-500 mt-0.5 shrink-0">warning</span>
                      {ec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {story.dependencies?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Dependencies</p>
                <div className="flex flex-wrap gap-1.5">
                  {story.dependencies.map((dep, i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 bg-surface-container border border-outline rounded-full text-on-surface-variant">
                      {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {hasExtra && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary-dim transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">{expanded ? "expand_less" : "expand_more"}</span>
            {expanded ? "Show less" : "Show edge cases & dependencies"}
          </button>
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
export default function StoryGeneratorAgent({ project, onNavigate }) {
  const [phase, setPhase]                         = useState("form");
  const [features, setFeatures]                   = useState([]);
  const [featuresLoading, setFeaturesLoading]     = useState(true);
  const [selectedFeatureId, setSelectedFeatureId] = useState("");
  const [storyCountHint, setStoryCountHint]       = useState("");
  const [constraints, setConstraints]             = useState([]);
  const [supportingCtx, setSupportingCtx]         = useState([]);
  const [jobMessage, setJobMessage]               = useState(null);
  const [stories, setStories]                     = useState([]);
  const [sourceFeatureTitle, setSourceFeatureTitle] = useState("");
  const [error, setError]                         = useState(null);
  const [storySkill, setStorySkill]               = useState(null);
  const wsRef = useRef(null);

  useEffect(() => () => wsRef.current?.close(), []);

  // Load project features for source selector
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    getProjectFeatures(project.id)
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : (data.features ?? []);
        setFeatures(rows);
        // Honour pre-selected feature from session (e.g. from Features tab "Generate Stories")
        let preselect = "";
        try { preselect = sessionStorage.getItem(STORY_SOURCE_FEATURE_KEY) ?? ""; } catch {}
        if (preselect && rows.some((f) => (f.id ?? f.feature_id) === preselect)) {
          setSelectedFeatureId(preselect);
          try { sessionStorage.removeItem(STORY_SOURCE_FEATURE_KEY); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFeaturesLoading(false); });
    return () => { cancelled = true; };
  }, [project?.id]);

  // Load active story_spec skill
  useEffect(() => {
    let cancelled = false;
    getSkills("story_spec", true)
      .then((result) => {
        if (cancelled) return;
        const rows = Array.isArray(result) ? result : (result.skills ?? []);
        setStorySkill(rows[0] ?? null);
      })
      .catch(() => { if (!cancelled) setStorySkill(null); });
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
        applyResult(job.result_payload, selectedFeatureId);
        ws.close();
      } else if (job.status === "failed" || job.status === "cancelled") {
        setError(job.error_message ?? "Story generation failed. Please retry.");
        setPhase("form");
        ws.close();
      }
    };

    ws.onerror = () => {
      setError("Connection lost. Please retry.");
      setPhase("form");
    };
  }

  function applyResult(payload, featureId) {
    const generated = payload?.stories ?? payload ?? [];
    setStories(Array.isArray(generated) ? generated : []);
    const src = features.find((f) => (f.id ?? f.feature_id) === featureId);
    setSourceFeatureTitle(src?.title ?? "");
    setPhase("result");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedFeatureId) return;
    setError(null);
    setPhase("running");
    setJobMessage("Initialising story generation...");
    try {
      const body = {
        project_id:        project.id,
        source_type:       "feature",
        source_feature_id: selectedFeatureId,
        ...(storyCountHint               ? { story_count_hint:   parseInt(storyCountHint, 10) } : {}),
        ...(constraints.length           ? { constraints }                                       : {}),
        ...(supportingCtx.length         ? { supporting_context: supportingCtx }                 : {}),
      };
      const result = await startStoryGeneratorJob(body);
      const id = result.job?.id;
      if (!id) throw new Error("No job ID returned from server.");
      setJobMessage(result.job.progress_message ?? "Generating stories...");
      connectSocket(id);
    } catch (err) {
      setError(err.message);
      setPhase("form");
    }
  }

  function handleReset() {
    wsRef.current?.close();
    setPhase("form");
    setStories([]);
    setError(null);
    setJobMessage(null);
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
            <span
              className="material-symbols-outlined text-[22px] text-white"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              receipt_long
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              Story Generator
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

            {/* Hero card */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 shadow-lg shadow-emerald-500/20">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="material-symbols-outlined text-[18px] text-emerald-200"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  receipt_long
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                  Story Generator
                </span>
              </div>
              <p className="text-[40px] font-headline font-black text-white leading-none">{stories.length}</p>
              <p className="text-[13px] text-emerald-100/80 mt-1">
                {stories.length === 1 ? "story generated" : "stories generated"}
              </p>
            </div>

            {/* Meta card */}
            <div className="bg-surface border border-outline rounded-2xl p-5 shadow-card space-y-4">
              {sourceFeatureTitle && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="material-symbols-outlined text-[14px] text-violet-500">auto_awesome</span>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Source Feature</span>
                  </div>
                  <p className="text-sm font-semibold text-on-surface leading-snug">{sourceFeatureTitle}</p>
                </div>
              )}

              {project && (
                <>
                  {sourceFeatureTitle && <div className="border-t border-outline/60" />}
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">inventory_2</span>
                    <span className="text-[11px] text-on-surface-variant">Project</span>
                    <span className="text-[11px] font-bold text-on-surface truncate">{project.name}</span>
                  </div>
                </>
              )}

              {storySkill && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-emerald-500">psychology</span>
                  <span className="text-[11px] text-on-surface-variant">Skill</span>
                  <span className="text-[11px] font-bold text-on-surface truncate">{storySkill.name}</span>
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
          </div>

          {/* ── Story list ── */}
          <div className="space-y-4">
            {stories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed border-outline rounded-2xl">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant">receipt_long</span>
                <p className="text-sm text-on-surface-variant">No stories returned. Try running again.</p>
                <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline rounded-lg text-sm font-semibold hover:border-primary hover:text-primary transition-all">
                  <span className="material-symbols-outlined text-[15px]">refresh</span>Run Again
                </button>
              </div>
            ) : (
              stories.map((story, i) => (
                <StoryCard key={i} story={story} index={i} />
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
        <PageHeader subtitle="Generating..." />
        <div className="bg-surface border border-outline rounded-2xl p-12 shadow-card flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-20 h-20 rounded-full bg-emerald-100 animate-ping opacity-40" />
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center shadow-sm z-10">
              <span
                className="material-symbols-outlined text-[28px] text-emerald-500"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                receipt_long
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-on-surface">{jobMessage ?? "Generating stories..."}</p>
            <p className="text-[12px] text-on-surface-variant mt-1.5">This usually takes 15–30 seconds</p>
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-emerald-300 via-emerald-500 to-emerald-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ─────────────────────────────────────────────────────────────
  return (
    <div className="px-10 py-10 max-w-2xl">
      <PageHeader subtitle="New Story Set" />

      {/* Project context */}
      {project && (
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-container border border-outline rounded-xl mb-6">
          <span className="material-symbols-outlined text-[15px] text-on-surface-variant">inventory_2</span>
          <span className="text-[12px] text-on-surface-variant">Running under</span>
          <span className="text-[12px] font-bold text-on-surface">{project.name}</span>
        </div>
      )}

      {/* Skill badge */}
      {storySkill && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-[15px] text-emerald-500">psychology</span>
          <span className="text-[12px] text-emerald-700">Using Story Spec Skill</span>
          <span className="text-[12px] font-bold text-emerald-900">{storySkill.name}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-error text-[16px]">error</span>
          <p className="text-sm text-red-700 flex-1">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Source feature selector */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Source Feature
          </label>
          {featuresLoading ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-container border border-outline rounded-lg">
              <span className="w-3.5 h-3.5 border-2 border-outline border-t-primary rounded-full animate-spin shrink-0" />
              <span className="text-sm text-on-surface-variant">Loading features...</span>
            </div>
          ) : features.length === 0 ? (
            <div className="px-4 py-4 bg-surface-container border border-outline rounded-xl space-y-1">
              <p className="text-sm font-semibold text-on-surface">No features found for this project.</p>
              <p className="text-[12px] text-on-surface-variant">
                Generate a feature first using the Feature Generator agent, then come back here.
              </p>
            </div>
          ) : (
            <select
              value={selectedFeatureId}
              onChange={(e) => setSelectedFeatureId(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
            >
              <option value="">Select a feature...</option>
              {features.map((f) => {
                const id = f.id ?? f.feature_id;
                return <option key={id} value={id}>{f.title || "Untitled Feature"}</option>;
              })}
            </select>
          )}
        </div>

        {/* Story count hint */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Story Count Hint <span className="normal-case font-normal tracking-normal">(optional)</span>
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={storyCountHint}
            onChange={(e) => setStoryCountHint(e.target.value)}
            placeholder="e.g. 5"
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 transition"
          />
          <p className="text-[10px] text-on-surface-variant mt-1">
            How many stories to aim for. Leave blank to let the agent decide.
          </p>
        </div>

        <TagInput
          label="Constraints"
          hint='e.g. "Stories must be independently shippable" — press Enter to add'
          tags={constraints}
          onAdd={(t) => setConstraints((p) => [...p, t])}
          onRemove={(i) => setConstraints((p) => p.filter((_, idx) => idx !== i))}
        />

        <TagInput
          label="Supporting Context"
          hint='e.g. "Based on Q1 2026 rider research" — press Enter to add'
          tags={supportingCtx}
          onAdd={(t) => setSupportingCtx((p) => [...p, t])}
          onRemove={(i) => setSupportingCtx((p) => p.filter((_, idx) => idx !== i))}
        />

        <div className="pt-2">
          <button
            type="submit"
            disabled={!selectedFeatureId || featuresLoading || features.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-bold rounded-xl hover:from-emerald-500 hover:to-emerald-600 transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              receipt_long
            </span>
            Generate Stories
          </button>
        </div>

      </form>
    </div>
  );
}
