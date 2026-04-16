import { useState, useRef, useEffect } from "react";
import { openJobSocket } from "../api/jobs";
import { startFeatureGeneratorJob } from "../api/agents";
import { getSkills } from "../api/skills";

// ─── Config ───────────────────────────────────────────────────────────────────
const SOURCE_TYPES = [
  { value: "prompt",       label: "Problem Statement"    },
  { value: "opportunity",  label: "Opportunity / Finding" },
  { value: "requirement",  label: "Requirement Context"  },
];

const PRIORITY_CONFIG = {
  high:   { label: "High",   badge: "bg-red-50 text-red-600 border-red-100"        },
  medium: { label: "Medium", badge: "bg-amber-50 text-amber-600 border-amber-100"  },
  low:    { label: "Low",    badge: "bg-slate-100 text-slate-500 border-slate-200" },
};

// ─── Tag input ────────────────────────────────────────────────────────────────
function TagInput({ label, hint, tags, onAdd, onRemove }) {
  const [input, setInput] = useState("");

  function handleKeyDown(e) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      onAdd(input.trim());
      setInput("");
    }
  }

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
        onKeyDown={handleKeyDown}
        placeholder={hint}
        className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 transition"
      />
      <p className="text-[10px] text-on-surface-variant mt-1">Press Enter to add</p>
    </div>
  );
}

// ─── Result section card ──────────────────────────────────────────────────────
function ResultSection({ icon, title, children }) {
  return (
    <div className="bg-surface border border-outline rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-[15px] text-primary">{icon}</span>
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{title}</h4>
      </div>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FeatureGeneratorAgent({ project, onNavigate }) {
  // phase: "form" | "running" | "result"
  const [phase, setPhase]                   = useState("form");
  const [sourceType, setSourceType]         = useState("prompt");
  const [sourceTitle, setSourceTitle]       = useState("");
  const [sourceSummary, setSourceSummary]   = useState("");
  const [sourceDetails, setSourceDetails]   = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [constraints, setConstraints]       = useState([]);
  const [supportingCtx, setSupportingCtx]   = useState([]);
  const [jobMessage, setJobMessage]         = useState(null);
  const [feature, setFeature]               = useState(null);
  const [error, setError]                   = useState(null);
  const [featureSkill, setFeatureSkill]     = useState(null);
  const wsRef = useRef(null);

  useEffect(() => () => wsRef.current?.close(), []);
  useEffect(() => {
    let cancelled = false;
    getSkills("feature_spec", true)
      .then((result) => {
        if (cancelled) return;
        const rows = Array.isArray(result) ? result : (result.skills ?? []);
        setFeatureSkill(rows[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setFeatureSkill(null);
      });
    return () => { cancelled = true; };
  }, []);

  function connectSocket(id) {
    wsRef.current?.close();
    const ws = openJobSocket(id);
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
        setError(job.error_message ?? "Feature generation failed. Please retry.");
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
    setFeature(payload?.feature ?? payload);
    setPhase("result");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!sourceTitle.trim() || !sourceSummary.trim()) return;
    setError(null);
    setPhase("running");
    setJobMessage("Initialising feature generation...");
    try {
      const body = {
        source_type:    sourceType,
        source_title:   sourceTitle.trim(),
        source_summary: sourceSummary.trim(),
        ...(sourceDetails.trim()  ? { source_details:     sourceDetails.trim()  } : {}),
        ...(desiredOutcome.trim() ? { desired_outcome:    desiredOutcome.trim() } : {}),
        ...(constraints.length    ? { constraints }                               : {}),
        ...(supportingCtx.length  ? { supporting_context: supportingCtx }         : {}),
        ...(project?.id           ? { project_id: project.id }                    : {}),
      };
      const result = await startFeatureGeneratorJob(body);
      const id = result.job?.id;
      if (!id) throw new Error("No job ID returned from server.");
      setJobMessage(result.job.progress_message ?? "Generating feature draft...");
      connectSocket(id);
    } catch (err) {
      setError(err.message);
      setPhase("form");
    }
  }

  function handleReset() {
    wsRef.current?.close();
    setPhase("form");
    setFeature(null);
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
          <div className="w-12 h-12 rounded-2xl bg-violet-50 border-2 border-violet-100 flex items-center justify-center shrink-0 shadow-sm">
            <span
              className="material-symbols-outlined text-[22px] text-violet-500"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              Feature Generator
            </p>
            <h2 className="text-2xl font-headline font-bold text-on-surface">{subtitle}</h2>
          </div>
        </div>
      </div>
    );
  }

  // ── Result view ───────────────────────────────────────────────────────────
  if (phase === "result" && feature) {
    const body   = feature.body ?? {};
    const priCfg = PRIORITY_CONFIG[body.priority] ?? PRIORITY_CONFIG.medium;

    return (
      <div className="px-10 py-10 max-w-4xl">
        <PageHeader subtitle={feature.title || "Generated Feature"} />

        {/* Summary bar */}
        <div className="flex items-center justify-between gap-4 mb-8 p-5 bg-surface border border-outline rounded-xl shadow-card">
          <div className="flex-1 min-w-0">
            {feature.summary && (
              <p className="text-sm text-on-surface-variant leading-relaxed">{feature.summary}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${priCfg.badge}`}>
              {priCfg.label} Priority
            </span>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface border border-outline text-on-surface text-sm font-bold rounded-lg hover:border-primary hover:text-primary transition-all"
            >
              <span className="material-symbols-outlined text-[15px]">refresh</span>
              Run Again
            </button>
          </div>
        </div>

        <div className="space-y-4">

          {/* Core three */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ResultSection icon="report_problem" title="Problem Statement">
              <p className="text-sm text-on-surface leading-relaxed">{body.problem_statement}</p>
            </ResultSection>
            <ResultSection icon="person" title="User Segment">
              <p className="text-sm text-on-surface leading-relaxed">{body.user_segment}</p>
            </ResultSection>
            <ResultSection icon="lightbulb" title="Proposed Solution">
              <p className="text-sm text-on-surface leading-relaxed">{body.proposed_solution}</p>
            </ResultSection>
          </div>

          {/* Value */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ResultSection icon="favorite" title="User Value">
              <p className="text-sm text-on-surface leading-relaxed">{body.user_value}</p>
            </ResultSection>
            <ResultSection icon="trending_up" title="Business Value">
              <p className="text-sm text-on-surface leading-relaxed">{body.business_value}</p>
            </ResultSection>
          </div>

          {/* Requirements */}
          {(body.functional_requirements?.length > 0 || body.non_functional_requirements?.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {body.functional_requirements?.length > 0 && (
                <ResultSection icon="checklist" title="Functional Requirements">
                  <ul className="space-y-2">
                    {body.functional_requirements.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                        <span className="material-symbols-outlined text-[14px] text-primary mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </ResultSection>
              )}
              {body.non_functional_requirements?.length > 0 && (
                <ResultSection icon="tune" title="Non-Functional Requirements">
                  <ul className="space-y-2">
                    {body.non_functional_requirements.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant mt-0.5 shrink-0">radio_button_unchecked</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </ResultSection>
              )}
            </div>
          )}

          {/* Dependencies + Metrics */}
          {(body.dependencies?.length > 0 || body.success_metrics?.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {body.dependencies?.length > 0 && (
                <ResultSection icon="link" title="Dependencies">
                  <ul className="space-y-2">
                    {body.dependencies.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                        <span className="material-symbols-outlined text-[14px] text-amber-500 mt-0.5 shrink-0">warning</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </ResultSection>
              )}
              {body.success_metrics?.length > 0 && (
                <ResultSection icon="analytics" title="Success Metrics">
                  <ul className="space-y-2">
                    {body.success_metrics.map((m, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                        <span className="material-symbols-outlined text-[14px] text-green-500 mt-0.5 shrink-0">bar_chart</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </ResultSection>
              )}
            </div>
          )}

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
          {/* Pulsing icon */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-20 h-20 rounded-full bg-violet-100 animate-ping opacity-40" />
            <div className="w-16 h-16 rounded-full bg-violet-50 border-2 border-violet-100 flex items-center justify-center shadow-sm z-10">
              <span
                className="material-symbols-outlined text-[28px] text-violet-500"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-on-surface">
              {jobMessage ?? "Generating feature draft..."}
            </p>
            <p className="text-[12px] text-on-surface-variant mt-1.5">
              This usually takes 15–30 seconds
            </p>
          </div>

          {/* Indeterminate progress bar */}
          <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-violet-300 via-primary to-violet-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ─────────────────────────────────────────────────────────────
  return (
    <div className="px-10 py-10 max-w-2xl">
      <PageHeader subtitle="New Feature" />

      {/* Project context banner */}
      {project && (
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-container border border-outline rounded-xl mb-6">
          <span className="material-symbols-outlined text-[15px] text-on-surface-variant">inventory_2</span>
          <span className="text-[12px] text-on-surface-variant">Running under</span>
          <span className="text-[12px] font-bold text-on-surface">{project.name}</span>
        </div>
      )}

      {featureSkill && (
        <div className="flex items-center gap-2 px-4 py-3 bg-violet-50 border border-violet-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-[15px] text-violet-500">psychology</span>
          <span className="text-[12px] text-violet-700">Using Feature Spec Skill</span>
          <span className="text-[12px] font-bold text-violet-900">{featureSkill.name}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-error text-[16px]">error</span>
          <p className="text-sm text-red-700 flex-1">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Source type */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Source Type
          </label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
          >
            {SOURCE_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Title
          </label>
          <input
            type="text"
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            placeholder="e.g. Frequent riders abandon booking at destination entry"
            required
            className="w-full px-3 py-2 text-sm font-semibold text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 transition"
          />
        </div>

        {/* Summary */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Summary
          </label>
          <textarea
            value={sourceSummary}
            onChange={(e) => setSourceSummary(e.target.value)}
            placeholder="Brief description of the problem or opportunity..."
            rows={3}
            required
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 resize-none transition"
          />
        </div>

        {/* Details (optional) */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Details <span className="normal-case font-normal tracking-normal">(optional)</span>
          </label>
          <textarea
            value={sourceDetails}
            onChange={(e) => setSourceDetails(e.target.value)}
            placeholder="Longer problem statement or copied requirement context..."
            rows={4}
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 resize-none transition"
          />
        </div>

        {/* Desired outcome (optional) */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Desired Outcome <span className="normal-case font-normal tracking-normal">(optional)</span>
          </label>
          <textarea
            value={desiredOutcome}
            onChange={(e) => setDesiredOutcome(e.target.value)}
            placeholder="What should the generated feature accomplish?"
            rows={2}
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 resize-none transition"
          />
        </div>

        <TagInput
          label="Constraints"
          hint='e.g. "Must work offline" — press Enter to add'
          tags={constraints}
          onAdd={(t) => setConstraints(p => [...p, t])}
          onRemove={(i) => setConstraints(p => p.filter((_, idx) => idx !== i))}
        />

        <TagInput
          label="Supporting Context"
          hint='e.g. "From rider research Q1 2026" — press Enter to add'
          tags={supportingCtx}
          onAdd={(t) => setSupportingCtx(p => [...p, t])}
          onRemove={(i) => setSupportingCtx(p => p.filter((_, idx) => idx !== i))}
        />

        <div className="pt-2">
          <button
            type="submit"
            disabled={!sourceTitle.trim() || !sourceSummary.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dim transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            Generate Feature
          </button>
        </div>

      </form>
    </div>
  );
}
