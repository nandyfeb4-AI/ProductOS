import { useState, useRef, useEffect } from "react";
import { openJobSocket } from "../api/jobs";
import { startCompetitorAnalysisJob, getGenerationJob } from "../api/agents";
import { getSkills } from "../api/skills";

// ─── Config ───────────────────────────────────────────────────────────────────
const THREAT_CFG = {
  high:   { label: "High Threat",   cls: "bg-rose-50 text-rose-700 border-rose-200"     },
  medium: { label: "Medium Threat", cls: "bg-amber-50 text-amber-700 border-amber-200"  },
  low:    { label: "Low Threat",    cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const CATEGORY_CFG = {
  direct:   { label: "Direct",   cls: "bg-red-50 text-red-700 border-red-200"              },
  adjacent: { label: "Adjacent", cls: "bg-violet-50 text-violet-700 border-violet-200"     },
  other:    { label: "Other",    cls: "bg-surface-container text-on-surface-variant border-outline" },
};

// ─── Competitor card ──────────────────────────────────────────────────────────
function CompetitorCard({ item }) {
  const analysis  = item.analysis ?? {};
  const threat    = (analysis.threat_level ?? "medium").toLowerCase();
  const category  = (analysis.category ?? "other").toLowerCase();
  const threatCfg = THREAT_CFG[threat]    ?? THREAT_CFG.medium;
  const catCfg    = CATEGORY_CFG[category] ?? CATEGORY_CFG.other;
  const [expanded, setExpanded] = useState(false);
  const hasExtra =
    (analysis.strengths?.length ?? 0) +
    (analysis.weaknesses?.length ?? 0) +
    (analysis.feature_gaps?.length ?? 0) > 0;

  return (
    <div className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-teal-50 border-b border-teal-100">
        <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center shrink-0">
          <span
            className="material-symbols-outlined text-[16px] text-white"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            business
          </span>
        </div>
        <h4 className="text-sm font-headline font-bold text-on-surface flex-1 leading-snug min-w-0">
          {item.competitor_name}
        </h4>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${catCfg.cls}`}>
            {catCfg.label}
          </span>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${threatCfg.cls}`}>
            {threatCfg.label}
          </span>
          {analysis.confidence_score != null && (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200">
              {analysis.confidence_score}/5
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* Competitor summary */}
        {item.competitor_summary && (
          <p className="text-[12px] text-on-surface-variant leading-relaxed">
            {item.competitor_summary}
          </p>
        )}

        {/* Positioning summary */}
        {analysis.positioning_summary && (
          <div className="px-3 py-2.5 bg-surface-container border border-outline rounded-lg">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
              Positioning
            </p>
            <p className="text-[12px] text-on-surface leading-relaxed">
              {analysis.positioning_summary}
            </p>
          </div>
        )}

        {/* Recommended response */}
        {analysis.recommended_response && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-teal-50/60 border border-teal-100 rounded-lg">
            <span className="material-symbols-outlined text-[14px] text-teal-600 mt-0.5 shrink-0">
              lightbulb
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-teal-700 mb-0.5">
                Recommended Response
              </p>
              <p className="text-[12px] text-teal-900 leading-relaxed">
                {analysis.recommended_response}
              </p>
            </div>
          </div>
        )}

        {/* Expandable: strengths / weaknesses / feature gaps */}
        {hasExtra && (
          <>
            {expanded && (
              <div className="space-y-4 pt-2 border-t border-outline/60">
                {analysis.strengths?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                      Strengths
                    </p>
                    <ul className="space-y-1">
                      {analysis.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                          <span
                            className="material-symbols-outlined text-[13px] text-emerald-500 mt-0.5 shrink-0"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            check_circle
                          </span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.weaknesses?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                      Weaknesses
                    </p>
                    <ul className="space-y-1">
                      {analysis.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                          <span
                            className="material-symbols-outlined text-[13px] text-rose-400 mt-0.5 shrink-0"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            remove_circle
                          </span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.feature_gaps?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                      Feature Gaps
                    </p>
                    <ul className="space-y-1">
                      {analysis.feature_gaps.map((g, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                          <span className="material-symbols-outlined text-[13px] text-amber-500 mt-0.5 shrink-0">
                            arrow_right
                          </span>
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
              className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">
                {expanded ? "expand_less" : "expand_more"}
              </span>
              {expanded ? "Hide details" : "Show strengths, weaknesses & gaps"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Chip input (required) ────────────────────────────────────────────────────
function ChipInput({ label, placeholder, chips, onAdd, onRemove }) {
  const [input, setInput] = useState("");
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
        {label}
      </label>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {chips.map((chip, i) => (
            <span
              key={i}
              className="flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-700 text-[11px] font-semibold rounded-full border border-teal-200"
            >
              {chip}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="hover:text-red-500 transition-colors ml-0.5"
              >
                <span className="material-symbols-outlined text-[12px]">close</span>
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
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
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 placeholder:text-on-surface-variant/40 transition"
        />
        <button
          type="button"
          onClick={() => { if (input.trim()) { onAdd(input.trim()); setInput(""); } }}
          className="px-3 py-2 bg-surface border border-outline rounded-lg text-sm font-semibold text-on-surface hover:border-teal-400 hover:text-teal-600 transition"
        >
          Add
        </button>
      </div>
      <p className="text-[10px] text-on-surface-variant mt-1">Press Enter to add</p>
    </div>
  );
}

// ─── Tag input (optional) ─────────────────────────────────────────────────────
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
              className="flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-700 text-[11px] font-semibold rounded-full border border-teal-200"
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="hover:text-red-500 transition-colors ml-0.5"
              >
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
        className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 placeholder:text-on-surface-variant/40 transition"
      />
      <p className="text-[10px] text-on-surface-variant mt-1">Press Enter to add</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CompetitorAnalysisAgent({ project, onNavigate }) {
  const [phase, setPhase]                 = useState("form");
  const [productName, setProductName]     = useState(project?.name ?? "");
  const [productSummary, setProductSummary] = useState(project?.description ?? "");
  const [targetMarket, setTargetMarket]   = useState("");
  const [competitors, setCompetitors]     = useState([]);
  const [analysisGoal, setAnalysisGoal]   = useState("");
  const [constraints, setConstraints]     = useState([]);
  const [supportingCtx, setSupportingCtx] = useState([]);
  const [jobMessage, setJobMessage]       = useState(null);
  const [result, setResult]               = useState(null);
  const [analysisSkill, setAnalysisSkill] = useState(null);
  const [error, setError]                 = useState(null);
  const wsRef   = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => () => {
    wsRef.current?.close();
    clearInterval(pollRef.current);
  }, []);

  // Load active competitor_analysis skill
  useEffect(() => {
    let cancelled = false;
    getSkills("competitor_analysis", true)
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res) ? res : (res.skills ?? []);
        setAnalysisSkill(rows[0] ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function applyJobResult(job) {
    if (job.status === "completed") {
      clearInterval(pollRef.current);
      setResult(job.result_payload);
      setPhase("result");
      return true;
    }
    if (job.status === "failed" || job.status === "cancelled") {
      clearInterval(pollRef.current);
      setError(job.error_message ?? "Analysis failed. Please retry.");
      setPhase("form");
      return true;
    }
    setJobMessage(job.progress_message ?? null);
    return false;
  }

  function startPolling(jobId) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await getGenerationJob(jobId);
        const job = res?.job ?? res;
        applyJobResult(job);
      } catch {
        // transient fetch error — keep polling
      }
    }, 3000);
  }

  function connectSocket(jobId) {
    wsRef.current?.close();
    const ws = openJobSocket(jobId);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      let parsed;
      try { parsed = JSON.parse(e.data); } catch { return; }
      if (parsed.event !== "job.updated") return;
      applyJobResult(parsed.job);
      if (parsed.job.status === "completed" || parsed.job.status === "failed" || parsed.job.status === "cancelled") {
        ws.close();
      }
    };

    ws.onerror = () => {
      // WebSocket dropped but the backend job is still running — fall back to polling
      startPolling(jobId);
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (competitors.length === 0) return;
    setError(null);
    setPhase("running");
    setJobMessage("Initialising competitor analysis...");
    try {
      const body = {
        project_id:        project.id,
        source_type:       "prompt",
        product_name:      productName.trim(),
        product_summary:   productSummary.trim(),
        target_market:     targetMarket.trim(),
        known_competitors: competitors,
        ...(analysisGoal         ? { analysis_goal:      analysisGoal.trim() } : {}),
        ...(constraints.length   ? { constraints }                              : {}),
        ...(supportingCtx.length ? { supporting_context: supportingCtx }       : {}),
      };
      const res = await startCompetitorAnalysisJob(body);
      const id = res.job?.id;
      if (!id) throw new Error("No job ID returned from server.");
      setJobMessage(res.job.progress_message ?? "Analyzing competitors...");
      connectSocket(id);
    } catch (err) {
      setError(err.message);
      setPhase("form");
    }
  }

  function handleReset() {
    wsRef.current?.close();
    clearInterval(pollRef.current);
    setPhase("form");
    setResult(null);
    setError(null);
    setJobMessage(null);
    setCompetitors([]);
  }

  // ─── Shared header ────────────────────────────────────────────────────────
  function AgentHeader({ subtitle }) {
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shrink-0 shadow-lg shadow-teal-500/20">
            <span
              className="material-symbols-outlined text-[22px] text-white"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              query_stats
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              Competitor Analysis
            </p>
            <h2 className="text-2xl font-headline font-bold text-on-surface">{subtitle}</h2>
          </div>
        </div>
      </div>
    );
  }

  // ─── Result view ──────────────────────────────────────────────────────────
  if (phase === "result" && result) {
    const items = result.results ?? [];
    const threatCounts = { high: 0, medium: 0, low: 0 };
    items.forEach((r) => {
      const t = (r.analysis?.threat_level ?? "medium").toLowerCase();
      if (threatCounts[t] !== undefined) threatCounts[t]++;
    });

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
            <div className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-2xl p-6 shadow-lg shadow-teal-500/20">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="material-symbols-outlined text-[18px] text-teal-200"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  query_stats
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-teal-200">
                  Competitor Analysis
                </span>
              </div>
              <p className="text-[40px] font-headline font-black text-white leading-none">{items.length}</p>
              <p className="text-[13px] text-teal-100/80 mt-1">
                {items.length === 1 ? "competitor analyzed" : "competitors analyzed"}
              </p>
            </div>

            {/* Meta + threat breakdown */}
            <div className="bg-surface border border-outline rounded-2xl p-5 shadow-card space-y-4">
              {project && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant">inventory_2</span>
                  <span className="text-[11px] text-on-surface-variant">Project</span>
                  <span className="text-[11px] font-bold text-on-surface truncate">{project.name}</span>
                </div>
              )}
              {analysisSkill && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-teal-500">psychology</span>
                  <span className="text-[11px] text-on-surface-variant">Skill</span>
                  <span className="text-[11px] font-bold text-on-surface truncate">{analysisSkill.name}</span>
                </div>
              )}
              <div className="border-t border-outline pt-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                  Threat Breakdown
                </p>
                <div className="space-y-1.5">
                  {(["high", "medium", "low"]).map((key) => {
                    const cfg = THREAT_CFG[key];
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[11px] font-bold text-on-surface">{threatCounts[key]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Market summary */}
            {result.market_summary && (
              <div className="bg-surface border border-outline rounded-2xl p-5 shadow-card">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                  Market Summary
                </p>
                <p className="text-[12px] text-on-surface-variant leading-relaxed">{result.market_summary}</p>
              </div>
            )}

            {/* Strategic recommendations */}
            {result.strategic_recommendations?.length > 0 && (
              <div className="bg-surface border border-outline rounded-2xl p-5 shadow-card">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                  Strategic Recommendations
                </p>
                <ul className="space-y-2">
                  {result.strategic_recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                      <span className="material-symbols-outlined text-[13px] text-teal-500 mt-0.5 shrink-0">
                        arrow_right
                      </span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Differentiation opportunities */}
            {result.differentiation_opportunities?.length > 0 && (
              <div className="bg-surface border border-outline rounded-2xl p-5 shadow-card">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                  Differentiation Opportunities
                </p>
                <ul className="space-y-2">
                  {result.differentiation_opportunities.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                      <span
                        className="material-symbols-outlined text-[13px] text-emerald-500 mt-0.5 shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        star
                      </span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Blind spots */}
            {result.blind_spots?.length > 0 && (
              <div className="bg-surface border border-outline rounded-2xl p-5 shadow-card">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                  Blind Spots
                </p>
                <ul className="space-y-2">
                  {result.blind_spots.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                      <span className="material-symbols-outlined text-[13px] text-amber-500 mt-0.5 shrink-0">
                        warning
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface border border-outline text-on-surface text-sm font-bold rounded-xl hover:border-teal-400 hover:text-teal-600 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Analyze Again
            </button>

          </div>

          {/* ── Competitor cards ── */}
          <div className="space-y-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed border-outline rounded-2xl">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant">query_stats</span>
                <p className="text-sm text-on-surface-variant">No results returned. Try running again.</p>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline rounded-lg text-sm font-semibold hover:border-teal-400 hover:text-teal-600 transition-all"
                >
                  <span className="material-symbols-outlined text-[15px]">refresh</span>
                  Run Again
                </button>
              </div>
            ) : (
              items.map((item, i) => (
                <CompetitorCard key={item.competitor_name ?? i} item={item} />
              ))
            )}
          </div>

        </div>
      </div>
    );
  }

  // ─── Running view ─────────────────────────────────────────────────────────
  if (phase === "running") {
    return (
      <div className="px-10 py-10 max-w-xl">
        <AgentHeader subtitle="Analyzing..." />
        <div className="bg-surface border border-outline rounded-2xl p-12 shadow-card flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-20 h-20 rounded-full bg-teal-100 animate-ping opacity-40" />
            <div className="w-16 h-16 rounded-full bg-teal-50 border-2 border-teal-100 flex items-center justify-center shadow-sm z-10">
              <span
                className="material-symbols-outlined text-[28px] text-teal-600"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                query_stats
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-on-surface">{jobMessage ?? "Analyzing competitors..."}</p>
            <p className="text-[12px] text-on-surface-variant mt-1.5">This usually takes 20–40 seconds</p>
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-teal-300 via-teal-500 to-teal-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ─── Form view ────────────────────────────────────────────────────────────
  return (
    <div className="px-10 py-10 max-w-2xl">
      <AgentHeader subtitle="Analyze Competitors" />

      {project && (
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-container border border-outline rounded-xl mb-4">
          <span className="material-symbols-outlined text-[15px] text-on-surface-variant">inventory_2</span>
          <span className="text-[12px] text-on-surface-variant">Running under</span>
          <span className="text-[12px] font-bold text-on-surface">{project.name}</span>
        </div>
      )}

      {analysisSkill && (
        <div className="flex items-center gap-2 px-4 py-3 bg-teal-50 border border-teal-100 rounded-xl mb-4">
          <span className="material-symbols-outlined text-[15px] text-teal-500">psychology</span>
          <span className="text-[12px] text-teal-700">Using Competitor Analysis Skill</span>
          <span className="text-[12px] font-bold text-teal-900">{analysisSkill.name}</span>
        </div>
      )}

      <p className="text-[12px] text-on-surface-variant mb-6 leading-relaxed">
        Analyze named competitors against your product context. Compare positioning, threats, gaps, and differentiation opportunities. Built from the product context you provide — not live market data.
      </p>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-error text-[16px]">error</span>
          <p className="text-sm text-red-700 flex-1">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Product name + target market */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
              Product Name
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              required
              placeholder="e.g. ProductOS"
              className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 placeholder:text-on-surface-variant/40 transition"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
              Target Market
            </label>
            <input
              type="text"
              value={targetMarket}
              onChange={(e) => setTargetMarket(e.target.value)}
              required
              placeholder="e.g. B2B SaaS product teams"
              className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 placeholder:text-on-surface-variant/40 transition"
            />
          </div>
        </div>

        {/* Product summary */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Product Summary
          </label>
          <textarea
            value={productSummary}
            onChange={(e) => setProductSummary(e.target.value)}
            required
            rows={3}
            placeholder="Describe what your product does and who it serves..."
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 placeholder:text-on-surface-variant/40 resize-none transition"
          />
        </div>

        {/* Competitors chip input */}
        <ChipInput
          label="Known Competitors"
          placeholder='e.g. "Productboard" — press Enter to add'
          chips={competitors}
          onAdd={(c) => setCompetitors((p) => [...p, c])}
          onRemove={(i) => setCompetitors((p) => p.filter((_, idx) => idx !== i))}
        />

        {/* Analysis goal */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Analysis Goal <span className="normal-case font-normal tracking-normal">(optional)</span>
          </label>
          <textarea
            value={analysisGoal}
            onChange={(e) => setAnalysisGoal(e.target.value)}
            rows={2}
            placeholder='e.g. "Understand where we should differentiate in PM workflow automation."'
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 placeholder:text-on-surface-variant/40 resize-none transition"
          />
        </div>

        <TagInput
          label="Constraints"
          hint='e.g. "Do not assume live web research" — press Enter to add'
          tags={constraints}
          onAdd={(t) => setConstraints((p) => [...p, t])}
          onRemove={(i) => setConstraints((p) => p.filter((_, idx) => idx !== i))}
        />

        <TagInput
          label="Supporting Context"
          hint='e.g. "Focus on backlog management" — press Enter to add'
          tags={supportingCtx}
          onAdd={(t) => setSupportingCtx((p) => [...p, t])}
          onRemove={(i) => setSupportingCtx((p) => p.filter((_, idx) => idx !== i))}
        />

        <div className="pt-2">
          <button
            type="submit"
            disabled={competitors.length === 0 || !productName.trim() || !productSummary.trim() || !targetMarket.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-700 text-white text-sm font-bold rounded-xl hover:from-teal-500 hover:to-teal-600 transition-all shadow-sm shadow-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              query_stats
            </span>
            Analyze {competitors.length > 0
              ? `${competitors.length} Competitor${competitors.length > 1 ? "s" : ""}`
              : "Competitors"}
          </button>
          {competitors.length === 0 && (
            <p className="text-[11px] text-on-surface-variant mt-2">
              Add at least one competitor to run the analysis.
            </p>
          )}
        </div>

      </form>
    </div>
  );
}
