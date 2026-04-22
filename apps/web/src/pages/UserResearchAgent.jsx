import { useState, useRef, useEffect } from "react";
import { openJobSocket } from "../api/jobs";
import { startUserResearchJob, getGenerationJob } from "../api/agents";
import { getSkills } from "../api/skills";

// ─── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ score }) {
  if (score == null) return null;
  const n = Number(score);
  const cls =
    n >= 4 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : n >= 3 ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-rose-50 text-rose-700 border-rose-200";
  return (
    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${cls}`}>
      {n}/5
    </span>
  );
}

// ─── Insight card ─────────────────────────────────────────────────────────────
function InsightCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const hasEvidence = (item.evidence?.length ?? 0) > 0;

  return (
    <div className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-card">
      <div className="flex items-center gap-3 px-5 py-3.5 bg-purple-50 border-b border-purple-100">
        <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center shrink-0">
          <span
            className="material-symbols-outlined text-[16px] text-white"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            person_search
          </span>
        </div>
        <h4 className="text-sm font-headline font-bold text-on-surface flex-1 leading-snug min-w-0">
          {item.insight_title}
        </h4>
        <ConfidenceBadge score={item.confidence_score} />
      </div>

      <div className="p-5 space-y-4">

        {item.insight_summary && (
          <p className="text-[12px] text-on-surface-variant leading-relaxed">
            {item.insight_summary}
          </p>
        )}

        {item.implication && (
          <div className="px-3 py-2.5 bg-surface-container border border-outline rounded-lg">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
              Implication
            </p>
            <p className="text-[12px] text-on-surface leading-relaxed">{item.implication}</p>
          </div>
        )}

        {item.recommended_action && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-purple-50/60 border border-purple-100 rounded-lg">
            <span className="material-symbols-outlined text-[14px] text-purple-600 mt-0.5 shrink-0">
              lightbulb
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-700 mb-0.5">
                Recommended Action
              </p>
              <p className="text-[12px] text-purple-900 leading-relaxed">{item.recommended_action}</p>
            </div>
          </div>
        )}

        {hasEvidence && (
          <>
            {expanded && (
              <div className="pt-2 border-t border-outline/60">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                  Evidence
                </p>
                <ul className="space-y-1">
                  {item.evidence.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                      <span className="material-symbols-outlined text-[13px] text-purple-400 mt-0.5 shrink-0">
                        arrow_right
                      </span>
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-600 hover:text-purple-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">
                {expanded ? "expand_less" : "expand_more"}
              </span>
              {expanded ? "Hide evidence" : `Show evidence (${item.evidence.length})`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Research input list builder ──────────────────────────────────────────────
function ResearchInputs({ inputs, onAdd, onRemove }) {
  const [draft, setDraft] = useState("");
  function commit() {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
  }
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
        Research Inputs
      </label>
      <p className="text-[11px] text-on-surface-variant mb-2 leading-relaxed">
        Paste interview notes, support themes, workshop signals, or user quotes. Each entry is one research input.
      </p>

      {inputs.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {inputs.map((input, i) => (
            <li
              key={i}
              className="flex items-start gap-2 px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg group"
            >
              <span className="material-symbols-outlined text-[13px] text-purple-400 mt-0.5 shrink-0">
                arrow_right
              </span>
              <span className="text-[12px] text-purple-900 flex-1 leading-relaxed">{input}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-purple-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
              >
                <span className="material-symbols-outlined text-[13px]">close</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && draft.trim()) {
              e.preventDefault();
              commit();
            }
          }}
          rows={2}
          placeholder='e.g. "PMs spend too much time translating workshop notes into backlog-ready artifacts."'
          className="flex-1 px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 placeholder:text-on-surface-variant/40 resize-none transition"
        />
        <button
          type="button"
          onClick={commit}
          className="px-3 py-2 bg-surface border border-outline rounded-lg text-sm font-semibold text-on-surface hover:border-purple-400 hover:text-purple-600 transition self-start"
        >
          Add
        </button>
      </div>
      <p className="text-[10px] text-on-surface-variant mt-1">Press Enter to add (Shift+Enter for new line)</p>
    </div>
  );
}

// ─── Optional tag input ───────────────────────────────────────────────────────
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
              className="flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 text-[11px] font-semibold rounded-full border border-purple-200"
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
        className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 placeholder:text-on-surface-variant/40 transition"
      />
      <p className="text-[10px] text-on-surface-variant mt-1">Press Enter to add</p>
    </div>
  );
}

// ─── List section (result view) ────────────────────────────────────────────────
function ResultList({ title, icon, iconCls, items }) {
  if (!items?.length) return null;
  return (
    <div className="bg-surface border border-outline rounded-2xl p-5 shadow-card">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
            <span className={`material-symbols-outlined text-[13px] ${iconCls} mt-0.5 shrink-0`}
              style={{ fontVariationSettings: "'FILL' 1" }}>
              {icon}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UserResearchAgent({ project, onNavigate }) {
  const [phase, setPhase]                   = useState("form");
  const [productName, setProductName]       = useState(project?.name ?? "");
  const [productSummary, setProductSummary] = useState(project?.description ?? "");
  const [targetUser, setTargetUser]         = useState("");
  const [researchInputs, setResearchInputs] = useState([]);
  const [researchGoal, setResearchGoal]     = useState("");
  const [constraints, setConstraints]       = useState([]);
  const [supportingCtx, setSupportingCtx]   = useState([]);
  const [jobMessage, setJobMessage]         = useState(null);
  const [result, setResult]                 = useState(null);
  const [researchSkill, setResearchSkill]   = useState(null);
  const [error, setError]                   = useState(null);
  const wsRef   = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => () => {
    wsRef.current?.close();
    clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSkills("user_research", true)
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res) ? res : (res.skills ?? []);
        setResearchSkill(rows[0] ?? null);
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
      setError(job.error_message ?? "Research synthesis failed. Please retry.");
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
      if (["completed", "failed", "cancelled"].includes(parsed.job.status)) ws.close();
    };

    ws.onerror = () => { startPolling(jobId); };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (researchInputs.length === 0) return;
    setError(null);
    setPhase("running");
    setJobMessage("Initialising research synthesis...");
    try {
      const body = {
        project_id:      project.id,
        source_type:     "prompt",
        product_name:    productName.trim(),
        product_summary: productSummary.trim(),
        target_user:     targetUser.trim(),
        research_inputs: researchInputs,
        ...(researchGoal           ? { research_goal:      researchGoal.trim()  } : {}),
        ...(constraints.length     ? { constraints }                              : {}),
        ...(supportingCtx.length   ? { supporting_context: supportingCtx }       : {}),
      };
      const res = await startUserResearchJob(body);
      const id = res.job?.id;
      if (!id) throw new Error("No job ID returned from server.");
      setJobMessage(res.job.progress_message ?? "Synthesizing research...");
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
    setResearchInputs([]);
  }

  // ─── Shared header ──────────────────────────────────────────────────────────
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
            <span
              className="material-symbols-outlined text-[22px] text-white"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              person_search
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              User Research
            </p>
            <h2 className="text-2xl font-headline font-bold text-on-surface">{subtitle}</h2>
          </div>
        </div>
      </div>
    );
  }

  // ─── Result view ────────────────────────────────────────────────────────────
  if (phase === "result" && result) {
    const insights = result.results ?? [];

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

            {/* Hero stat */}
            <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-6 shadow-lg shadow-purple-500/20">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="material-symbols-outlined text-[18px] text-purple-200"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  person_search
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-200">
                  User Research
                </span>
              </div>
              <p className="text-[40px] font-headline font-black text-white leading-none">{insights.length}</p>
              <p className="text-[13px] text-purple-100/80 mt-1">
                {insights.length === 1 ? "insight synthesized" : "insights synthesized"}
              </p>
            </div>

            {/* Meta */}
            <div className="bg-surface border border-outline rounded-2xl p-5 shadow-card space-y-3">
              {project && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant">inventory_2</span>
                  <span className="text-[11px] text-on-surface-variant">Project</span>
                  <span className="text-[11px] font-bold text-on-surface truncate">{project.name}</span>
                </div>
              )}
              {researchSkill && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-purple-500">psychology</span>
                  <span className="text-[11px] text-on-surface-variant">Skill</span>
                  <span className="text-[11px] font-bold text-on-surface truncate">{researchSkill.name}</span>
                </div>
              )}
            </div>

            {/* Research summary */}
            {result.research_summary && (
              <div className="bg-surface border border-outline rounded-2xl p-5 shadow-card">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                  Research Summary
                </p>
                <p className="text-[12px] text-on-surface-variant leading-relaxed">
                  {result.research_summary}
                </p>
              </div>
            )}

            <ResultList
              title="User Segments"
              icon="group"
              iconCls="text-purple-400"
              items={result.user_segments}
            />
            <ResultList
              title="Key Pain Points"
              icon="report_problem"
              iconCls="text-rose-400"
              items={result.key_pain_points}
            />
            <ResultList
              title="Unmet Needs"
              icon="warning"
              iconCls="text-amber-400"
              items={result.unmet_needs}
            />
            <ResultList
              title="Jobs To Be Done"
              icon="task_alt"
              iconCls="text-emerald-500"
              items={result.jobs_to_be_done}
            />
            <ResultList
              title="Recommended Actions"
              icon="arrow_right"
              iconCls="text-purple-500"
              items={result.recommended_actions}
            />
            <ResultList
              title="Risks & Unknowns"
              icon="help"
              iconCls="text-slate-400"
              items={result.risks_and_unknowns}
            />

            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface border border-outline text-on-surface text-sm font-bold rounded-xl hover:border-purple-400 hover:text-purple-600 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Synthesize Again
            </button>
          </div>

          {/* ── Insight cards ── */}
          <div className="space-y-4">
            {insights.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed border-outline rounded-2xl">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant">person_search</span>
                <p className="text-sm text-on-surface-variant">No insights returned. Try running again.</p>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline rounded-lg text-sm font-semibold hover:border-purple-400 hover:text-purple-600 transition-all"
                >
                  <span className="material-symbols-outlined text-[15px]">refresh</span>
                  Run Again
                </button>
              </div>
            ) : (
              insights.map((item, i) => (
                <InsightCard key={item.insight_title ?? i} item={item} />
              ))
            )}
          </div>

        </div>
      </div>
    );
  }

  // ─── Running view ───────────────────────────────────────────────────────────
  if (phase === "running") {
    return (
      <div className="px-10 py-10 max-w-xl">
        <AgentHeader subtitle="Synthesizing..." />
        <div className="bg-surface border border-outline rounded-2xl p-12 shadow-card flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-20 h-20 rounded-full bg-purple-100 animate-ping opacity-40" />
            <div className="w-16 h-16 rounded-full bg-purple-50 border-2 border-purple-100 flex items-center justify-center shadow-sm z-10">
              <span
                className="material-symbols-outlined text-[28px] text-purple-600"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                person_search
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-on-surface">{jobMessage ?? "Synthesizing research inputs..."}</p>
            <p className="text-[12px] text-on-surface-variant mt-1.5">This usually takes 20–40 seconds</p>
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-purple-300 via-purple-500 to-purple-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ─── Form view ──────────────────────────────────────────────────────────────
  return (
    <div className="px-10 py-10 max-w-2xl">
      <AgentHeader subtitle="Synthesize User Research" />

      {project && (
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-container border border-outline rounded-xl mb-4">
          <span className="material-symbols-outlined text-[15px] text-on-surface-variant">inventory_2</span>
          <span className="text-[12px] text-on-surface-variant">Running under</span>
          <span className="text-[12px] font-bold text-on-surface">{project.name}</span>
        </div>
      )}

      {researchSkill && (
        <div className="flex items-center gap-2 px-4 py-3 bg-purple-50 border border-purple-100 rounded-xl mb-4">
          <span className="material-symbols-outlined text-[15px] text-purple-500">psychology</span>
          <span className="text-[12px] text-purple-700">Using User Research Skill</span>
          <span className="text-[12px] font-bold text-purple-900">{researchSkill.name}</span>
        </div>
      )}

      <p className="text-[12px] text-on-surface-variant mb-6 leading-relaxed">
        Turn notes, interviews, and user signals into PM-ready findings. Built from the research context you provide — not live user monitoring or external citations.
      </p>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl mb-6">
          <span className="material-symbols-outlined text-error text-[16px]">error</span>
          <p className="text-sm text-red-700 flex-1">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Product name + target user */}
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
              className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 placeholder:text-on-surface-variant/40 transition"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
              Target User
            </label>
            <input
              type="text"
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              required
              placeholder="e.g. B2B SaaS product managers"
              className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 placeholder:text-on-surface-variant/40 transition"
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
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 placeholder:text-on-surface-variant/40 resize-none transition"
          />
        </div>

        {/* Research inputs — the core field */}
        <ResearchInputs
          inputs={researchInputs}
          onAdd={(v) => setResearchInputs((p) => [...p, v])}
          onRemove={(i) => setResearchInputs((p) => p.filter((_, idx) => idx !== i))}
        />

        {/* Research goal */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Research Goal <span className="normal-case font-normal tracking-normal">(optional)</span>
          </label>
          <textarea
            value={researchGoal}
            onChange={(e) => setResearchGoal(e.target.value)}
            rows={2}
            placeholder='e.g. "Identify the strongest recurring pain points in PM workflow operations."'
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 placeholder:text-on-surface-variant/40 resize-none transition"
          />
        </div>

        <TagInput
          label="Constraints"
          hint='e.g. "Do not assume live research or fresh interviews" — press Enter'
          tags={constraints}
          onAdd={(t) => setConstraints((p) => [...p, t])}
          onRemove={(i) => setConstraints((p) => p.filter((_, idx) => idx !== i))}
        />

        <TagInput
          label="Supporting Context"
          hint='e.g. "Focus on discovery-to-delivery operations" — press Enter'
          tags={supportingCtx}
          onAdd={(t) => setSupportingCtx((p) => [...p, t])}
          onRemove={(i) => setSupportingCtx((p) => p.filter((_, idx) => idx !== i))}
        />

        <div className="pt-2">
          <button
            type="submit"
            disabled={
              researchInputs.length === 0 ||
              !productName.trim() ||
              !productSummary.trim() ||
              !targetUser.trim()
            }
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm font-bold rounded-xl hover:from-purple-500 hover:to-purple-600 transition-all shadow-sm shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              person_search
            </span>
            Synthesize{researchInputs.length > 0
              ? ` ${researchInputs.length} Input${researchInputs.length > 1 ? "s" : ""}`
              : " Research"}
          </button>
          {researchInputs.length === 0 && (
            <p className="text-[11px] text-on-surface-variant mt-2">
              Add at least one research input to run the synthesis.
            </p>
          )}
        </div>

      </form>
    </div>
  );
}
