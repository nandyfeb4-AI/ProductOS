import { useState, useRef, useEffect } from "react";
import { openJobSocket } from "../api/jobs";
import { startFeatureRefinementJob } from "../api/agents";
import { getSkills } from "../api/skills";
import { getProjectFeatures } from "../api/projectFeatures";

const FEATURE_REFINER_SOURCE_KEY = "feature_refiner_source_feature_id";

// ─── Refined feature card ─────────────────────────────────────────────────────
function RefinedFeatureCard({ result, index }) {
  // Backend shape: result = { feature_id, refinement_summary, evaluation, feature: { title, summary, body } }
  // Fallback shape (from applyResult map): result = { refined: <ProjectFeatureResponse> }
  const feature    = result.feature ?? result.refined ?? result;
  const body       = feature.body ?? feature;
  const evaluation = result.evaluation ?? null;
  const score      = evaluation?.overall_score ?? null;
  const gaps       = evaluation?.gaps ?? [];
  const strengths  = evaluation?.strengths ?? [];
  const perItemSummary = result.refinement_summary ?? "";
  const [expanded, setExpanded] = useState(false);
  const hasEval = gaps.length > 0 || strengths.length > 0;

  return (
    <div className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-indigo-50 border-b border-indigo-100">
        <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-black text-white leading-none">{index + 1}</span>
        </div>
        <h4 className="text-sm font-headline font-bold text-on-surface flex-1 leading-snug">
          {feature.title || "Untitled Feature"}
        </h4>
        {score != null && (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-600/10 text-indigo-700 border border-indigo-200 shrink-0">
            {typeof score === "number" ? score.toFixed(1) : score}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Summary */}
        {feature.summary && (
          <p className="text-[13px] text-on-surface-variant leading-relaxed">{feature.summary}</p>
        )}

        {/* Per-item refinement summary */}
        {perItemSummary && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-indigo-50/60 border border-indigo-100 rounded-lg">
            <span className="material-symbols-outlined text-[14px] text-indigo-500 mt-0.5 shrink-0">info</span>
            <p className="text-[12px] text-indigo-800 leading-relaxed">{perItemSummary}</p>
          </div>
        )}

        {/* Key body sections */}
        {body.problem_statement && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Problem Statement</p>
            <p className="text-[12px] text-on-surface-variant leading-relaxed bg-surface-container border border-outline rounded-lg px-3 py-2.5">
              {body.problem_statement}
            </p>
          </div>
        )}

        {body.proposed_solution && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Proposed Solution</p>
            <p className="text-[12px] text-on-surface-variant leading-relaxed bg-surface-container border border-outline rounded-lg px-3 py-2.5">
              {body.proposed_solution}
            </p>
          </div>
        )}

        {/* Success metrics */}
        {body.success_metrics?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Success Metrics</p>
            <ul className="space-y-1">
              {body.success_metrics.map((m, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                  <span
                    className="material-symbols-outlined text-[12px] text-indigo-500 mt-0.5 shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  {m}
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
              className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
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
              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[11px] font-semibold rounded-full border border-indigo-200"
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
        className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 placeholder:text-on-surface-variant/40 transition"
      />
      <p className="text-[10px] text-on-surface-variant mt-1">Press Enter to add</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FeatureRefinerAgent({ project, onNavigate }) {
  const [phase, setPhase]                       = useState("form");
  const [features, setFeatures]                 = useState([]);
  const [featuresLoading, setFeaturesLoading]   = useState(true);
  const [selectedFeatureId, setSelectedFeatureId] = useState("");
  const [refinementGoal, setRefinementGoal]     = useState("");
  const [constraints, setConstraints]           = useState([]);
  const [supportingCtx, setSupportingCtx]       = useState([]);
  const [jobMessage, setJobMessage]             = useState(null);
  const [refinedResults, setRefinedResults]     = useState([]);
  const [refinementSummary, setRefinementSummary] = useState("");
  const [refinerSkill, setRefinerSkill]         = useState(null);
  const [error, setError]                       = useState(null);
  const wsRef = useRef(null);

  useEffect(() => () => wsRef.current?.close(), []);

  // Load project features, honour pre-selected feature from sessionStorage
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    getProjectFeatures(project.id)
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : (data.features ?? []);
        setFeatures(rows);
        let preselect = "";
        try { preselect = sessionStorage.getItem(FEATURE_REFINER_SOURCE_KEY) ?? ""; } catch {}
        if (preselect && rows.some((f) => (f.id ?? f.feature_id) === preselect)) {
          setSelectedFeatureId(preselect);
          try { sessionStorage.removeItem(FEATURE_REFINER_SOURCE_KEY); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFeaturesLoading(false); });
    return () => { cancelled = true; };
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load active feature_refinement skill
  useEffect(() => {
    let cancelled = false;
    getSkills("feature_refinement", true)
      .then((result) => {
        if (cancelled) return;
        const rows = Array.isArray(result) ? result : (result.skills ?? []);
        setRefinerSkill(rows[0] ?? null);
      })
      .catch(() => { if (!cancelled) setRefinerSkill(null); });
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
        setError(job.error_message ?? "Feature refinement failed. Please retry.");
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
    const results = payload?.results
      ?? (payload?.features ?? []).map((f) => ({ refined: f }));
    setRefinedResults(Array.isArray(results) ? results : []);
    setRefinementSummary(payload?.summary ?? payload?.refinement_summary ?? "");
    setPhase("result");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedFeatureId) return;
    setError(null);
    setPhase("running");
    setJobMessage("Initialising feature refinement...");
    try {
      const body = {
        project_id:  project.id,
        source_type: "project_feature",
        feature_ids: [selectedFeatureId],
        ...(refinementGoal       ? { refinement_goal:   refinementGoal }   : {}),
        ...(constraints.length   ? { constraints }                          : {}),
        ...(supportingCtx.length ? { supporting_context: supportingCtx }   : {}),
      };
      const result = await startFeatureRefinementJob(body);
      const id = result.job?.id;
      if (!id) throw new Error("No job ID returned from server.");
      setJobMessage(result.job.progress_message ?? "Refining feature...");
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
            <span
              className="material-symbols-outlined text-[22px] text-white"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_fix_high
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              Feature Refiner
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

            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl p-6 shadow-lg shadow-indigo-500/20">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="material-symbols-outlined text-[18px] text-indigo-200"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  auto_fix_high
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">
                  Feature Refiner
                </span>
              </div>
              <p className="text-[40px] font-headline font-black text-white leading-none">{refinedResults.length}</p>
              <p className="text-[13px] text-indigo-100/80 mt-1">
                {refinedResults.length === 1 ? "feature refined" : "features refined"}
              </p>
            </div>

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
                  <span className="material-symbols-outlined text-[14px] text-indigo-500">psychology</span>
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

            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface border border-outline text-on-surface text-sm font-bold rounded-xl hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Refine Again
            </button>
          </div>

          {/* ── Refined features ── */}
          <div className="space-y-4">
            {refinedResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed border-outline rounded-2xl">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant">auto_fix_high</span>
                <p className="text-sm text-on-surface-variant">No results returned. Try running again.</p>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline rounded-lg text-sm font-semibold hover:border-indigo-400 hover:text-indigo-600 transition-all"
                >
                  <span className="material-symbols-outlined text-[15px]">refresh</span>
                  Run Again
                </button>
              </div>
            ) : (
              refinedResults.map((result, i) => (
                <RefinedFeatureCard
                  key={result.feature_id ?? result.refined?.id ?? i}
                  result={result}
                  index={i}
                />
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
            <div className="absolute w-20 h-20 rounded-full bg-indigo-100 animate-ping opacity-40" />
            <div className="w-16 h-16 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center shadow-sm z-10">
              <span
                className="material-symbols-outlined text-[28px] text-indigo-600"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_fix_high
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-on-surface">{jobMessage ?? "Refining feature..."}</p>
            <p className="text-[12px] text-on-surface-variant mt-1.5">This usually takes 15–30 seconds</p>
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-indigo-300 via-indigo-500 to-indigo-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ─────────────────────────────────────────────────────────────
  return (
    <div className="px-10 py-10 max-w-2xl">
      <PageHeader subtitle="Refine a Feature" />

      {project && (
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-container border border-outline rounded-xl mb-4">
          <span className="material-symbols-outlined text-[15px] text-on-surface-variant">inventory_2</span>
          <span className="text-[12px] text-on-surface-variant">Running under</span>
          <span className="text-[12px] font-bold text-on-surface">{project.name}</span>
        </div>
      )}

      {refinerSkill && (
        <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-[15px] text-indigo-500">psychology</span>
          <span className="text-[12px] text-indigo-700">Using Feature Refinement Skill</span>
          <span className="text-[12px] font-bold text-indigo-900">{refinerSkill.name}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-error text-[16px]">error</span>
          <p className="text-sm text-red-700 flex-1">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Feature selector */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Source Feature
          </label>
          {featuresLoading ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-container border border-outline rounded-lg">
              <span className="w-3.5 h-3.5 border-2 border-outline border-t-indigo-500 rounded-full animate-spin shrink-0" />
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
              className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
            >
              <option value="">Select a feature to refine...</option>
              {features.map((f) => {
                const id = f.id ?? f.feature_id;
                return <option key={id} value={id}>{f.title || "Untitled Feature"}</option>;
              })}
            </select>
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
            placeholder='e.g. "Sharpen the success metrics and tighten the functional requirements"'
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 placeholder:text-on-surface-variant/40 transition resize-none"
          />
        </div>

        <TagInput
          label="Constraints"
          hint='e.g. "Keep scope to mobile only" — press Enter to add'
          tags={constraints}
          onAdd={(t) => setConstraints((p) => [...p, t])}
          onRemove={(i) => setConstraints((p) => p.filter((_, idx) => idx !== i))}
        />

        <TagInput
          label="Supporting Context"
          hint='e.g. "Aligned with Q2 OKR on retention" — press Enter to add'
          tags={supportingCtx}
          onAdd={(t) => setSupportingCtx((p) => [...p, t])}
          onRemove={(i) => setSupportingCtx((p) => p.filter((_, idx) => idx !== i))}
        />

        <div className="pt-2">
          <button
            type="submit"
            disabled={!selectedFeatureId || featuresLoading || features.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-bold rounded-xl hover:from-indigo-500 hover:to-indigo-600 transition-all shadow-sm shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_fix_high
            </span>
            Refine Feature
          </button>
        </div>

      </form>
    </div>
  );
}
