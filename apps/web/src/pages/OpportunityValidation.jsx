import { useState, useMemo, useEffect, useRef } from "react";
import PipelineFlowBar from "../components/pipeline/PipelineFlowBar";
import { getFlowbarCompletedSteps } from "../api/workflows";
import { startOpportunitySynthesisJob, getJob, openJobSocket } from "../api/jobs";
import AIProgressCard from "../components/AIProgressCard";
import { persistWorkflowStep } from "../api/workflows";

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  experience_steps:     { label: "Experience Steps",      icon: "route",        color: "bg-blue-50 text-blue-600 border-blue-100"   },
  interactions:         { label: "Interactions",           icon: "touch_app",    color: "bg-slate-100 text-slate-600 border-slate-200" },
  goals_and_motivations:{ label: "Goals & Motivations",   icon: "flag",         color: "bg-purple-50 text-purple-600 border-purple-100"},
  positive_moments:     { label: "Positive Moments",      icon: "thumb_up",     color: "bg-green-50 text-green-600 border-green-100"  },
  negative_moments:     { label: "Negative Moments",      icon: "thumb_down",   color: "bg-red-50 text-red-600 border-red-100"        },
  areas_of_opportunity: { label: "Opportunities",         icon: "lightbulb",    color: "bg-amber-50 text-amber-600 border-amber-100"  },
};

const IMPACT_CONFIG = {
  high:   { label: "High Impact",   color: "bg-red-50 text-red-600 border border-red-100"     },
  medium: { label: "Med Impact",    color: "bg-amber-50 text-amber-600 border border-amber-100"},
  low:    { label: "Low Impact",    color: "bg-slate-50 text-slate-500 border border-slate-200"},
};

// ─── Confidence ring ──────────────────────────────────────────────────────────
function ConfidenceBadge({ value }) {
  const color = value >= 80 ? "text-green-600 bg-green-50 border-green-100"
               : value >= 60 ? "text-amber-600 bg-amber-50 border-amber-100"
               : "text-slate-500 bg-slate-50 border-slate-200";
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {value}% confidence
    </span>
  );
}

// ─── Evidence chip ────────────────────────────────────────────────────────────
function EvidenceChip({ text, category }) {
  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.interactions;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${cfg.color}`}>
      <span className="material-symbols-outlined text-[10px]">{cfg.icon}</span>
      {text.length > 40 ? text.slice(0, 40) + "…" : text}
    </span>
  );
}

// ─── Opportunity card ─────────────────────────────────────────────────────────
function OpportunityCard({ opp, onApprove, onDiscard, onEdit, isApproved }) {
  const [expanded, setExpanded] = useState(false);
  const impact = IMPACT_CONFIG[opp.impact] ?? IMPACT_CONFIG.medium;

  return (
    <div className={[
      "rounded-xl border transition-all",
      isApproved
        ? "border-green-200 bg-green-50/40"
        : "border-blue-100 bg-blue-50/20 hover:border-blue-200",
    ].join(" ")}>

      {/* Card header */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
              AI Synthesized
            </span>
            <ConfidenceBadge value={opp.confidence ?? 80} />
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${impact.color}`}>
              {impact.label}
            </span>
          </div>
          {isApproved && (
            <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-green-600">
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Approved
            </span>
          )}
        </div>

        <h3 className="text-base font-headline font-bold text-on-surface mb-2">{opp.title}</h3>

        <div className="mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Problem</span>
          <p className="text-sm text-on-surface-variant leading-relaxed mt-1">{opp.problem_statement}</p>
        </div>

        {opp.why_it_matters && (
          <div className="mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Why It Matters</span>
            <p className="text-sm text-on-surface-variant leading-relaxed mt-1">{opp.why_it_matters}</p>
          </div>
        )}

        {/* Evidence tags */}
        {opp.evidence?.length > 0 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
              Supporting Evidence
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(expanded ? opp.evidence : opp.evidence.slice(0, 3)).map((ev, i) => (
                <EvidenceChip key={i} text={ev.text} category={ev.category} />
              ))}
              {!expanded && opp.evidence.length > 3 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-[10px] font-bold text-primary hover:text-primary-dim transition-colors px-2 py-0.5"
                >
                  +{opp.evidence.length - 3} more
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isApproved && (
        <div className="px-5 py-3 border-t border-blue-100 flex items-center gap-2">
          <button
            onClick={() => onApprove(opp.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-[12px] font-bold rounded-lg hover:bg-primary-dim transition-all"
          >
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Approve
          </button>
          <button
            onClick={() => onEdit(opp.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-outline text-[12px] font-semibold text-on-surface-variant rounded-lg hover:bg-surface-container transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">edit</span>
            Edit
          </button>
          <button
            onClick={() => onDiscard(opp.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-on-surface-variant rounded-lg hover:bg-red-50 hover:text-error transition-all ml-auto"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
            Discard
          </button>
        </div>
      )}

      {isApproved && (
        <div className="px-5 py-3 border-t border-green-100 flex items-center justify-between">
          <span className="text-[11px] text-green-600 font-medium">Ready for solution shaping</span>
          <button
            onClick={() => onDiscard(opp.id)}
            className="text-[11px] text-on-surface-variant hover:text-error transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[13px]">undo</span>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Evidence rail ────────────────────────────────────────────────────────────
function EvidenceRail({ journey }) {
  const [activeStage, setActiveStage] = useState(0);
  const [collapsed, setCollapsed]     = useState(false);

  if (!journey?.stages?.length) return null;

  const stage = journey.stages[activeStage];
  const cats  = stage?.categories ?? {};
  const totalSignals = Object.values(cats).reduce((s, a) => s + (a?.length ?? 0), 0);

  return (
    <div className="bg-surface border border-outline rounded-xl mb-6 overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">account_tree</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            Source Evidence
          </span>
          <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full border border-outline">
            {journey.stages.reduce((s, st) =>
              s + Object.values(st.categories ?? {}).reduce((a, b) => a + (b?.length ?? 0), 0), 0
            )} signals
          </span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">
            {collapsed ? "expand_more" : "expand_less"}
          </span>
          {collapsed ? "Show evidence" : "Collapse"}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Stage tabs */}
          <div className="flex border-b border-outline overflow-x-auto">
            {journey.stages.map((s, i) => {
              const count = Object.values(s.categories ?? {}).reduce((a, b) => a + (b?.length ?? 0), 0);
              return (
                <button
                  key={i}
                  onClick={() => setActiveStage(i)}
                  className={[
                    "flex items-center gap-2 px-5 py-3 text-[12px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors",
                    i === activeStage
                      ? "text-primary border-primary"
                      : "text-on-surface-variant border-transparent hover:text-on-surface",
                  ].join(" ")}
                >
                  {s.stage}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    i === activeStage ? "bg-primary text-white" : "bg-surface-container text-on-surface-variant border border-outline"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Signal grid */}
          <div className="grid grid-cols-3 gap-4 p-5">
            {Object.entries(cats).map(([key, items]) => {
              if (!items?.length) return null;
              const cfg = CATEGORY_CONFIG[key] ?? CATEGORY_CONFIG.interactions;
              return (
                <div key={key}>
                  <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-2 ${cfg.color.split(" ")[1]}`}>
                    <span className="material-symbols-outlined text-[12px]">{cfg.icon}</span>
                    {cfg.label}
                    <span className="ml-auto font-bold opacity-70">{items.length}</span>
                  </div>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((item, i) => (
                      <div key={i} className={`text-[11px] px-2.5 py-1.5 rounded-lg border ${cfg.color} leading-snug`}>
                        {item}
                      </div>
                    ))}
                    {items.length > 3 && (
                      <p className="text-[10px] text-on-surface-variant pl-1">+{items.length - 3} more signals</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OpportunityValidation({ onNavigate }) {
  // Load workshop data from session storage
  const workshopData = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("workshop_pipeline_data") ?? "null"); }
    catch { return null; }
  }, []);

  const persistedValidationData = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("opportunity_pipeline_data") ?? "null"); }
    catch { return null; }
  }, []);

  const [synthesizing, setSynthesizing] = useState(false);
  const [candidates, setCandidates]     = useState(
    () => persistedValidationData?.candidates ?? persistedValidationData?.opportunities ?? []
  );
  const [approved, setApproved]         = useState(
    () => new Set(persistedValidationData?.approved_ids ?? [])
  );
  const [discarded, setDiscarded]       = useState(
    () => new Set(persistedValidationData?.discarded_ids ?? [])
  );
  const [error, setError]               = useState(null);
  const [jobMessage, setJobMessage]     = useState(null);
  const wsRef = useRef(null);

  const [jobId, setJobId] = useState(
    () => sessionStorage.getItem("validation_job_id") ?? null
  );
  function storeJobId(id) {
    if (id) sessionStorage.setItem("validation_job_id", id);
    else    sessionStorage.removeItem("validation_job_id");
    setJobId(id);
  }

  const visible = candidates.filter(c => !discarded.has(c.id));
  const approvedList = visible.filter(c => approved.has(c.id));
  const pendingList  = visible.filter(c => !approved.has(c.id));

  useEffect(() => {
    sessionStorage.setItem(
      "opportunity_pipeline_data",
      JSON.stringify({
        candidates,
        approved_ids: Array.from(approved),
        discarded_ids: Array.from(discarded),
        opportunities: approvedList,
      })
    );
  }, [approved, approvedList, candidates, discarded]);

  // On mount: reconnect to any in-flight job from a previous navigation
  useEffect(() => {
    if (jobId) setSynthesizing(true);
    return () => wsRef.current?.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wire WebSocket whenever jobId changes
  useEffect(() => {
    if (!jobId) return;
    getJob(jobId).then((job) => {
      setJobMessage(job.progress_message ?? null);
      if (job.status === "completed") {
        applyResult(job.result_payload);
        storeJobId(null);
        return;
      }
      if (job.status === "failed" || job.status === "cancelled") {
        setError(job.error_message ?? "AI generation failed. Please retry.");
        setSynthesizing(false);
        storeJobId(null);
        return;
      }
      setSynthesizing(true);
      connectSocket(jobId);
    }).catch(() => { setSynthesizing(true); connectSocket(jobId); });

    function connectSocket(id) {
      wsRef.current?.close();
      const ws = openJobSocket(id);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        let parsed; try { parsed = JSON.parse(e.data); } catch { return; }
        if (parsed.event !== "job.updated") return;
        const job = parsed.job;
        setJobMessage(job.progress_message ?? null);
        if (job.status === "completed") {
          applyResult(job.result_payload); storeJobId(null); ws.close();
        } else if (job.status === "failed" || job.status === "cancelled") {
          setError(job.error_message ?? "AI generation failed. Please retry.");
          setSynthesizing(false); storeJobId(null); ws.close();
        }
      };
      ws.onerror = () => {
        setError("Connection to generation service lost. Please retry.");
        setSynthesizing(false);
        storeJobId(null);
      };
    }
    return () => wsRef.current?.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  function applyResult(payload) {
    const withIds = (payload?.opportunities ?? []).map((o, i) => ({
      ...o,
      id: o.id ?? `opp-${i}`,
    }));
    setCandidates(withIds);
    setApproved(new Set());
    setDiscarded(new Set());
    setSynthesizing(false);
  }

  async function handleSynthesize() {
    wsRef.current?.close();
    storeJobId(null);
    setSynthesizing(true);
    setError(null);
    try {
      const payload = {
        insights: workshopData?.insights ?? null,
        journey:  workshopData?.journey  ?? null,
        title:    workshopData?.title    ?? "Workshop",
      };
      const result = await startOpportunitySynthesisJob(payload);
      const id = result.job?.id;
      if (!id) throw new Error("Job start failed — no job ID returned.");
      storeJobId(id);
      setJobMessage(result.job.progress_message ?? null);
    } catch (e) {
      setError(e.message);
      setSynthesizing(false);
    }
  }

  function handleApprove(id) {
    setApproved(prev => new Set([...prev, id]));
  }

  function handleDiscard(id) {
    setApproved(prev => { const n = new Set(prev); n.delete(id); return n; });
    setDiscarded(prev => new Set([...prev, id]));
  }

  function handleEdit(id) {
    // TODO: inline edit modal — phase 2
    console.log("Edit:", id);
  }

  function handleShapeSolutions() {
    const approvedOpps = approvedList;
    sessionStorage.setItem("opportunity_pipeline_data", JSON.stringify({ opportunities: approvedOpps }));
    persistWorkflowStep("opportunity");
    onNavigate?.("shaping");
  }

  return (
    <div>
      <PipelineFlowBar
        currentStep="validation"
        completedSteps={getFlowbarCompletedSteps("validation")}
        onNavigate={onNavigate}
      />

      <div className="px-10 py-10">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1 text-[11px] text-on-surface-variant font-medium">
              <button onClick={() => onNavigate?.("workshop")} className="hover:text-primary transition-colors">
                Workshop Intelligence
              </button>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-on-surface font-semibold">Opportunity Validation</span>
            </div>
            <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface mb-2">
              Opportunity <span className="text-primary">Validation</span>
            </h2>
            <p className="text-on-surface-variant text-sm max-w-xl leading-relaxed">
              Review AI-synthesized opportunities derived from your workshop evidence.
              Approve what matters, discard what doesn't — only approved items move to solution shaping.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {workshopData?.title && (
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline rounded-lg">
                <span className="material-symbols-outlined text-[14px] text-on-surface-variant">source</span>
                <span className="text-[12px] font-medium text-on-surface-variant truncate max-w-[160px]">
                  {workshopData.title}
                </span>
              </div>
            )}
            <button
              onClick={handleSynthesize}
              disabled={synthesizing}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary-dim transition-all active:scale-95 disabled:opacity-50 shadow-sm"
            >
              {synthesizing ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              )}
              {synthesizing ? "Synthesizing..." : candidates.length ? "Re-synthesize" : "Synthesize Opportunities"}
            </button>
          </div>
        </div>

        {/* ── Trust level legend ───────────────────────────────────────── */}
        <div className="flex items-center gap-6 mb-6 p-4 bg-surface border border-outline rounded-xl shadow-card">
          <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Signal Trust:</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-slate-200 border border-slate-300" />
            <span className="text-[11px] text-on-surface-variant">Raw Evidence</span>
          </div>
          <div className="w-px h-4 bg-outline" />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-200" />
            <span className="text-[11px] text-on-surface-variant">AI Synthesized</span>
          </div>
          <div className="w-px h-4 bg-outline" />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-green-100 border border-green-200" />
            <span className="text-[11px] text-on-surface-variant">PM Approved</span>
          </div>
        </div>

        {/* ── Evidence rail ────────────────────────────────────────────── */}
        {workshopData?.journey && <EvidenceRail journey={workshopData.journey} />}

        {/* ── Main area: candidates + approved ────────────────────────── */}
        <div className="grid grid-cols-12 gap-8">

          {/* Candidates — 8 cols */}
          <div className="col-span-12 lg:col-span-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  AI Opportunity Candidates
                </span>
                {candidates.length > 0 && (
                  <span className="text-[10px] font-bold bg-blue-50 text-primary border border-blue-100 px-2 py-0.5 rounded-full">
                    {pendingList.length} pending
                  </span>
                )}
              </div>
            </div>

            {/* First-load error card */}
            {!synthesizing && error && candidates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 bg-surface border border-red-100 rounded-xl shadow-card">
                <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[28px] text-error">cloud_off</span>
                </div>
                <h3 className="text-base font-headline font-bold text-on-surface mb-2">AI service unavailable</h3>
                <p className="text-sm text-on-surface-variant text-center max-w-sm leading-relaxed mb-6">{error}</p>
                <button
                  onClick={handleSynthesize}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dim transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  Retry
                </button>
              </div>
            )}

            {/* Empty state */}
            {!synthesizing && !error && candidates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 bg-surface border border-outline rounded-xl shadow-card">
                <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[28px] text-primary">auto_awesome</span>
                </div>
                <h3 className="text-base font-headline font-bold text-on-surface mb-2">
                  Ready to synthesize
                </h3>
                <p className="text-sm text-on-surface-variant text-center max-w-sm leading-relaxed mb-6">
                  {workshopData
                    ? "Click \"Synthesize Opportunities\" to let AI analyse your extracted signals and identify the most valuable improvement opportunities."
                    : "No workshop data found. Return to Workshop Intelligence and complete an analysis first."}
                </p>
                {!workshopData && (
                  <button
                    onClick={() => onNavigate?.("workshop")}
                    className="flex items-center gap-2 px-4 py-2 border border-outline rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    Back to Workshop
                  </button>
                )}
              </div>
            )}

            {/* In-progress card */}
            {synthesizing && (
              <AIProgressCard
                headline="Synthesizing opportunities"
                message={jobMessage ?? "Analysing your workshop signals and identifying the most valuable improvement opportunities."}
              />
            )}

            {/* Candidate cards */}
            {!synthesizing && pendingList.length > 0 && (
              <div className="space-y-4">
                {pendingList.map(opp => (
                  <OpportunityCard
                    key={opp.id}
                    opp={opp}
                    isApproved={false}
                    onApprove={handleApprove}
                    onEdit={handleEdit}
                    onDiscard={handleDiscard}
                  />
                ))}
              </div>
            )}

            {/* All done state */}
            {!synthesizing && candidates.length > 0 && pendingList.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 bg-green-50/50 border border-green-100 rounded-xl">
                <span className="material-symbols-outlined text-[32px] text-green-500 mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>
                  task_alt
                </span>
                <p className="text-sm font-semibold text-green-700">All opportunities reviewed</p>
                <p className="text-[12px] text-green-600 mt-1">{approvedList.length} approved and ready for solution shaping</p>
              </div>
            )}

            {error && candidates.length > 0 && (
              <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-error text-[18px] mt-0.5">error</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700">Synthesis failed</p>
                  <p className="text-[12px] text-red-600 mt-0.5">{error}</p>
                </div>
                <button
                  onClick={handleSynthesize}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-semibold transition-all shrink-0"
                >
                  <span className="material-symbols-outlined text-[14px]">refresh</span>
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* Approved panel — 4 cols */}
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-surface border border-outline rounded-xl overflow-hidden shadow-card sticky top-[76px]">
              {/* Header */}
              <div className="px-5 py-4 border-b border-outline flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-green-500">verified</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                    PM Approved
                  </span>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                  approvedList.length > 0
                    ? "bg-green-50 text-green-600 border-green-100"
                    : "bg-surface-container text-on-surface-variant border-outline"
                }`}>
                  {approvedList.length} approved
                </span>
              </div>

              {/* Approved list */}
              <div className="p-4 min-h-[200px]">
                {approvedList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-10 h-10 rounded-full bg-surface-container border border-outline flex items-center justify-center mb-3">
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant">add_task</span>
                    </div>
                    <p className="text-[12px] text-on-surface-variant leading-relaxed">
                      Approve opportunities from the<br />candidates panel to add them here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {approvedList.map((opp, i) => (
                      <div key={opp.id} className="flex items-start gap-3 p-3 bg-green-50/60 border border-green-100 rounded-lg">
                        <span className="material-symbols-outlined text-green-500 text-[16px] mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                          check_circle
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-on-surface leading-snug">{opp.title}</p>
                          {opp.impact && (
                            <p className="text-[10px] text-on-surface-variant mt-0.5 capitalize">{opp.impact} impact</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDiscard(opp.id)}
                          className="text-on-surface-variant/50 hover:text-error transition-colors shrink-0"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Convert CTA */}
              <div className="px-4 pb-4 pt-0">
                <button
                  onClick={handleShapeSolutions}
                  disabled={approvedList.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary-dim transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">transform</span>
                  Shape Solutions
                </button>
                {approvedList.length > 0 && (
                  <p className="text-[10px] text-on-surface-variant text-center mt-2">
                    {approvedList.length} opportunit{approvedList.length === 1 ? "y" : "ies"} ready to shape
                  </p>
                )}
              </div>

              {/* Stats */}
              {candidates.length > 0 && (
                <div className="border-t border-outline px-4 py-3 grid grid-cols-3 text-center gap-2">
                  <div>
                    <p className="text-base font-headline font-bold text-on-surface">{candidates.length}</p>
                    <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Total</p>
                  </div>
                  <div>
                    <p className="text-base font-headline font-bold text-green-600">{approvedList.length}</p>
                    <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Approved</p>
                  </div>
                  <div>
                    <p className="text-base font-headline font-bold text-on-surface-variant">{discarded.size}</p>
                    <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Discarded</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
