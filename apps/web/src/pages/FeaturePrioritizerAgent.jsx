import { useState, useRef, useEffect } from "react";
import { openJobSocket } from "../api/jobs";
import { startFeaturePrioritizationJob } from "../api/agents";
import { getSkills } from "../api/skills";
import { getProjectFeatures } from "../api/projectFeatures";

const FEATURE_PRIORITIZER_SOURCE_KEY = "feature_prioritizer_source_feature_id";
const MAX_FEATURES = 8;

const BUCKET_CFG = {
  high:   { label: "High",   cls: "bg-rose-50 text-rose-700 border-rose-200"    },
  medium: { label: "Medium", cls: "bg-amber-50 text-amber-700 border-amber-200"  },
  low:    { label: "Low",    cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ label, value, invert }) {
  const pct = ((value - 1) / 4) * 100;
  const barColor = invert
    ? pct > 60 ? "bg-rose-400" : pct > 30 ? "bg-amber-400" : "bg-emerald-400"
    : pct > 60 ? "bg-emerald-400" : pct > 30 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-on-surface-variant w-36 shrink-0 leading-tight">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold text-on-surface w-4 text-right shrink-0">{value}</span>
    </div>
  );
}

// ─── Prioritized feature card ─────────────────────────────────────────────────
function PrioritizedFeatureCard({ result, feature }) {
  const p = result.prioritization ?? {};
  const bucket = (p.priority_bucket ?? "medium").toLowerCase();
  const bucketCfg = BUCKET_CFG[bucket] ?? BUCKET_CFG.medium;
  const [expanded, setExpanded] = useState(false);
  const hasDetails = (p.rationale?.length > 0) || (p.tradeoffs?.length > 0);
  const title = feature?.title || "Unknown Feature";
  const summary = feature?.summary ?? "";

  return (
    <div className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-orange-50 border-b border-orange-100">
        <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
          <span className="text-[11px] font-black text-white leading-none">#{p.recommended_rank ?? "?"}</span>
        </div>
        <h4 className="text-sm font-headline font-bold text-on-surface flex-1 leading-snug min-w-0 truncate">
          {title}
        </h4>
        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${bucketCfg.cls}`}>
          {bucketCfg.label}
        </span>
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 shrink-0">
          {p.overall_priority_score ?? "—"}/5
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Feature summary */}
        {summary && (
          <p className="text-[12px] text-on-surface-variant leading-relaxed line-clamp-2">{summary}</p>
        )}

        {/* Per-item prioritization summary */}
        {result.prioritization_summary && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-orange-50/60 border border-orange-100 rounded-lg">
            <span className="material-symbols-outlined text-[14px] text-orange-500 mt-0.5 shrink-0">info</span>
            <p className="text-[12px] text-orange-800 leading-relaxed">{result.prioritization_summary}</p>
          </div>
        )}

        {/* Score breakdown */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Score Breakdown</p>
          <ScoreBar label="Impact" value={p.impact_score ?? 3} />
          <ScoreBar label="Effort (lower = better)" value={p.effort_score ?? 3} invert />
          <ScoreBar label="Strategic Alignment" value={p.strategic_alignment_score ?? 3} />
          <ScoreBar label="Urgency" value={p.urgency_score ?? 3} />
          <ScoreBar label="Confidence" value={p.confidence_score ?? 3} />
        </div>

        {/* Recommendation */}
        {p.recommendation && (
          <div className="px-3 py-2.5 bg-surface-container border border-outline rounded-lg">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Recommendation</p>
            <p className="text-[12px] text-on-surface leading-relaxed">{p.recommendation}</p>
          </div>
        )}

        {/* Framework badge */}
        {p.framework && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-surface-container border-outline text-on-surface-variant w-fit">
            <span className="material-symbols-outlined text-[11px]">schema</span>
            {p.framework}
          </span>
        )}

        {/* Expandable: rationale + tradeoffs */}
        {hasDetails && (
          <>
            {expanded && (
              <div className="space-y-3 pt-2 border-t border-outline/60">
                {p.rationale?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Rationale</p>
                    <ul className="space-y-1">
                      {p.rationale.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                          <span className="material-symbols-outlined text-[13px] text-orange-500 mt-0.5 shrink-0">arrow_right</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {p.tradeoffs?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Tradeoffs</p>
                    <ul className="space-y-1">
                      {p.tradeoffs.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                          <span className="material-symbols-outlined text-[13px] text-amber-500 mt-0.5 shrink-0">balance</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 hover:text-orange-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">
                {expanded ? "expand_less" : "expand_more"}
              </span>
              {expanded ? "Hide details" : "Show rationale & tradeoffs"}
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
              className="flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-700 text-[11px] font-semibold rounded-full border border-orange-200"
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
        className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 placeholder:text-on-surface-variant/40 transition"
      />
      <p className="text-[10px] text-on-surface-variant mt-1">Press Enter to add</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FeaturePrioritizerAgent({ project, onNavigate }) {
  const [phase, setPhase]                         = useState("form");
  const [features, setFeatures]                   = useState([]);
  const [featuresLoading, setFeaturesLoading]     = useState(true);
  const [selected, setSelected]                   = useState(new Set());
  const [prioritizationGoal, setPrioritizationGoal] = useState("");
  const [constraints, setConstraints]             = useState([]);
  const [supportingCtx, setSupportingCtx]         = useState([]);
  const [jobMessage, setJobMessage]               = useState(null);
  const [prioritizedResults, setPrioritizedResults] = useState([]);
  const [prioritizationSummary, setPrioritizationSummary] = useState("");
  const [prioritizerSkill, setPrioritizerSkill]   = useState(null);
  const [error, setError]                         = useState(null);
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
        try { preselect = sessionStorage.getItem(FEATURE_PRIORITIZER_SOURCE_KEY) ?? ""; } catch {}
        if (preselect && rows.some((f) => (f.id ?? f.feature_id) === preselect)) {
          setSelected(new Set([preselect]));
          try { sessionStorage.removeItem(FEATURE_PRIORITIZER_SOURCE_KEY); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFeaturesLoading(false); });
    return () => { cancelled = true; };
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load active feature_prioritization skill
  useEffect(() => {
    let cancelled = false;
    getSkills("feature_prioritization", true)
      .then((result) => {
        if (cancelled) return;
        const rows = Array.isArray(result) ? result : (result.skills ?? []);
        setPrioritizerSkill(rows[0] ?? null);
      })
      .catch(() => { if (!cancelled) setPrioritizerSkill(null); });
    return () => { cancelled = true; };
  }, []);


  function toggleFeature(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_FEATURES) {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === Math.min(features.length, MAX_FEATURES)) {
      setSelected(new Set());
    } else {
      setSelected(new Set(features.slice(0, MAX_FEATURES).map((f) => f.id ?? f.feature_id)));
    }
  }

  const atCap = selected.size >= MAX_FEATURES;
  const allSelected = features.length > 0 && selected.size === Math.min(features.length, MAX_FEATURES);

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
        setError(job.error_message ?? "Feature prioritization failed. Please retry.");
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
    const raw = payload?.results ?? [];
    const sorted = [...raw].sort(
      (a, b) => (a.prioritization?.recommended_rank ?? 99) - (b.prioritization?.recommended_rank ?? 99)
    );
    setPrioritizedResults(sorted);
    setPrioritizationSummary(payload?.prioritization_summary ?? "");
    setPhase("result");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (selected.size === 0) return;
    setError(null);
    setPhase("running");
    setJobMessage("Initialising feature prioritization...");
    try {
      const body = {
        project_id:  project.id,
        source_type: "project_feature",
        feature_ids: [...selected],
        ...(prioritizationGoal   ? { prioritization_goal: prioritizationGoal } : {}),
        ...(constraints.length   ? { constraints }                              : {}),
        ...(supportingCtx.length ? { supporting_context: supportingCtx }       : {}),
      };
      const result = await startFeaturePrioritizationJob(body);
      const id = result.job?.id;
      if (!id) throw new Error("No job ID returned from server.");
      setJobMessage(result.job.progress_message ?? "Prioritizing features...");
      connectSocket(id);
    } catch (err) {
      setError(err.message);
      setPhase("form");
    }
  }

  function handleReset() {
    wsRef.current?.close();
    setPhase("form");
    setPrioritizedResults([]);
    setError(null);
    setJobMessage(null);
    setPrioritizationSummary("");
    setSelected(new Set());
  }

  // ── Shared page header ──────────────────────────────────────────────────────
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20">
            <span
              className="material-symbols-outlined text-[22px] text-white"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              sort
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              Feature Prioritizer
            </p>
            <h2 className="text-2xl font-headline font-bold text-on-surface">{subtitle}</h2>
          </div>
        </div>
      </div>
    );
  }

  // ── Result view ─────────────────────────────────────────────────────────────
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

            <div className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl p-6 shadow-lg shadow-orange-500/20">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="material-symbols-outlined text-[18px] text-orange-200"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  sort
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-orange-200">
                  Feature Prioritizer
                </span>
              </div>
              <p className="text-[40px] font-headline font-black text-white leading-none">{prioritizedResults.length}</p>
              <p className="text-[13px] text-orange-100/80 mt-1">
                {prioritizedResults.length === 1 ? "feature ranked" : "features ranked"}
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
              {prioritizerSkill && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-orange-500">psychology</span>
                  <span className="text-[11px] text-on-surface-variant">Skill</span>
                  <span className="text-[11px] font-bold text-on-surface truncate">{prioritizerSkill.name}</span>
                </div>
              )}
              {prioritizationSummary && (
                <div className="border-t border-outline pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Overall Summary</p>
                  <p className="text-[12px] text-on-surface-variant leading-relaxed">{prioritizationSummary}</p>
                </div>
              )}
              {/* Bucket legend */}
              <div className="border-t border-outline pt-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Priority Buckets</p>
                <div className="space-y-1.5">
                  {Object.entries(BUCKET_CFG).map(([key, cfg]) => {
                    const count = prioritizedResults.filter(
                      (r) => (r.prioritization?.priority_bucket ?? "medium").toLowerCase() === key
                    ).length;
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[11px] font-bold text-on-surface">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface border border-outline text-on-surface text-sm font-bold rounded-xl hover:border-orange-400 hover:text-orange-600 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Prioritize Again
            </button>
          </div>

          {/* ── Ranked features ── */}
          <div className="space-y-4">
            {prioritizedResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed border-outline rounded-2xl">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant">sort</span>
                <p className="text-sm text-on-surface-variant">No results returned. Try running again.</p>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline rounded-lg text-sm font-semibold hover:border-orange-400 hover:text-orange-600 transition-all"
                >
                  <span className="material-symbols-outlined text-[15px]">refresh</span>
                  Run Again
                </button>
              </div>
            ) : (
              prioritizedResults.map((result) => (
                <PrioritizedFeatureCard
                  key={result.feature?.id ?? result.feature?.feature_id}
                  result={result}
                  feature={result.feature ?? null}
                />
              ))
            )}
          </div>

        </div>
      </div>
    );
  }

  // ── Running view ────────────────────────────────────────────────────────────
  if (phase === "running") {
    return (
      <div className="px-10 py-10 max-w-xl">
        <PageHeader subtitle="Prioritizing..." />
        <div className="bg-surface border border-outline rounded-2xl p-12 shadow-card flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-20 h-20 rounded-full bg-orange-100 animate-ping opacity-40" />
            <div className="w-16 h-16 rounded-full bg-orange-50 border-2 border-orange-100 flex items-center justify-center shadow-sm z-10">
              <span
                className="material-symbols-outlined text-[28px] text-orange-600"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                sort
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-on-surface">{jobMessage ?? "Prioritizing features..."}</p>
            <p className="text-[12px] text-on-surface-variant mt-1.5">This usually takes 15–30 seconds</p>
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-orange-300 via-orange-500 to-orange-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ───────────────────────────────────────────────────────────────
  return (
    <div className="px-10 py-10 max-w-2xl">
      <PageHeader subtitle="Prioritize Features" />

      {project && (
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-container border border-outline rounded-xl mb-4">
          <span className="material-symbols-outlined text-[15px] text-on-surface-variant">inventory_2</span>
          <span className="text-[12px] text-on-surface-variant">Running under</span>
          <span className="text-[12px] font-bold text-on-surface">{project.name}</span>
        </div>
      )}

      {prioritizerSkill && (
        <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-[15px] text-orange-500">psychology</span>
          <span className="text-[12px] text-orange-700">Using Feature Prioritization Skill</span>
          <span className="text-[12px] font-bold text-orange-900">{prioritizerSkill.name}</span>
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
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Features to Prioritize
            </label>
            <span className={`text-[10px] font-semibold ${atCap ? "text-amber-600" : "text-on-surface-variant"}`}>
              {selected.size} / {MAX_FEATURES} selected{atCap ? " — limit reached" : ""}
            </span>
          </div>

          {featuresLoading ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-container border border-outline rounded-lg">
              <span className="w-3.5 h-3.5 border-2 border-outline border-t-orange-500 rounded-full animate-spin shrink-0" />
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
            <div className="bg-surface border border-outline rounded-xl overflow-hidden">
              {/* Toggle all */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-container border-b border-outline">
                <input
                  type="checkbox"
                  id="toggle-all"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                />
                <label htmlFor="toggle-all" className="text-[11px] font-semibold text-on-surface-variant cursor-pointer select-none">
                  {allSelected ? "Deselect all" : `Select all${features.length > MAX_FEATURES ? ` (first ${MAX_FEATURES})` : ""}`}
                </label>
              </div>

              <div className="divide-y divide-outline/60 max-h-72 overflow-y-auto">
                {features.map((f) => {
                  const id = f.id ?? f.feature_id;
                  const isChecked = selected.has(id);
                  const isDisabled = !isChecked && atCap;
                  return (
                    <label
                      key={id}
                      className={[
                        "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors",
                        isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-surface-container/60",
                        isChecked ? "bg-orange-50/40" : "",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={() => toggleFeature(id)}
                        className="mt-0.5 w-4 h-4 accent-orange-500 rounded shrink-0 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface leading-snug">{f.title || "Untitled Feature"}</p>
                        {f.summary && (
                          <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-1">{f.summary}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Prioritization goal */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Prioritization Goal <span className="normal-case font-normal tracking-normal">(optional)</span>
          </label>
          <textarea
            value={prioritizationGoal}
            onChange={(e) => setPrioritizationGoal(e.target.value)}
            rows={3}
            placeholder='e.g. "Focus on Q3 retention goals and minimize engineering effort"'
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 placeholder:text-on-surface-variant/40 transition resize-none"
          />
        </div>

        <TagInput
          label="Constraints"
          hint='e.g. "Mobile team is at capacity" — press Enter to add'
          tags={constraints}
          onAdd={(t) => setConstraints((p) => [...p, t])}
          onRemove={(i) => setConstraints((p) => p.filter((_, idx) => idx !== i))}
        />

        <TagInput
          label="Supporting Context"
          hint='e.g. "Aligned with NPS improvement OKR" — press Enter to add'
          tags={supportingCtx}
          onAdd={(t) => setSupportingCtx((p) => [...p, t])}
          onRemove={(i) => setSupportingCtx((p) => p.filter((_, idx) => idx !== i))}
        />

        <div className="pt-2">
          <button
            type="submit"
            disabled={selected.size === 0 || featuresLoading || features.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-bold rounded-xl hover:from-orange-400 hover:to-orange-500 transition-all shadow-sm shadow-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              sort
            </span>
            Prioritize {selected.size > 0 ? `${selected.size} Feature${selected.size > 1 ? "s" : ""}` : "Features"}
          </button>
        </div>

      </form>
    </div>
  );
}
