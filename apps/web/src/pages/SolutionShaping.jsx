import { useEffect, useMemo, useRef, useState } from "react";
import PipelineFlowBar from "../components/pipeline/PipelineFlowBar";
import { getFlowbarCompletedSteps } from "../api/workflows";
import { startSolutionShapingJob, getJob, openJobSocket } from "../api/jobs";
import AIProgressCard from "../components/AIProgressCard";
import { persistWorkflowStep } from "../api/workflows";

// ─── Artifact type catalogue ──────────────────────────────────────────────────
const ARTIFACT_TYPES = [
  {
    id: "Initiative",
    label: "Initiative",
    icon: "flag",
    description: "Large strategic effort spanning multiple features",
    cardBg:    "bg-purple-50/50 border-purple-200",
    badge:     "bg-purple-100 text-purple-700 border border-purple-200",
    button:    "bg-purple-600 text-white hover:bg-purple-700",
    buttonOut: "border-purple-200 text-purple-600 hover:bg-purple-50",
    dot:       "bg-purple-500",
    countBox:  "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    id: "Feature",
    label: "Feature",
    icon: "widgets",
    description: "Discrete user-facing capability",
    cardBg:    "bg-blue-50/50 border-blue-200",
    badge:     "bg-blue-100 text-blue-700 border border-blue-200",
    button:    "bg-blue-600 text-white hover:bg-blue-700",
    buttonOut: "border-blue-200 text-blue-600 hover:bg-blue-50",
    dot:       "bg-blue-500",
    countBox:  "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "Enhancement",
    label: "Enhancement",
    icon: "tune",
    description: "Improvement to an existing capability",
    cardBg:    "bg-amber-50/50 border-amber-200",
    badge:     "bg-amber-100 text-amber-700 border border-amber-200",
    button:    "bg-amber-500 text-white hover:bg-amber-600",
    buttonOut: "border-amber-200 text-amber-600 hover:bg-amber-50",
    dot:       "bg-amber-500",
    countBox:  "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    id: "No action",
    label: "Defer",
    icon: "schedule",
    description: "Log for later — not actionable now",
    cardBg:    "bg-slate-50/80 border-slate-200",
    badge:     "bg-slate-100 text-slate-500 border border-slate-200",
    button:    "bg-slate-500 text-white hover:bg-slate-600",
    buttonOut: "border-slate-200 text-slate-500 hover:bg-slate-50",
    dot:       "bg-slate-400",
    countBox:  "bg-slate-50 text-slate-500 border-slate-200",
  },
];

function getType(id) {
  return ARTIFACT_TYPES.find(t => t.id === id) ?? ARTIFACT_TYPES[1];
}

// ─── Skeleton placeholder while AI is thinking ────────────────────────────────
function ShapingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-surface border border-outline rounded-xl p-5 space-y-4 animate-pulse shadow-card">
          <div className="flex gap-2">
            <div className="h-5 w-24 bg-surface-container rounded-full" />
            <div className="h-5 w-20 bg-surface-container rounded-full" />
          </div>
          <div className="h-5 w-3/4 bg-surface-container rounded" />
          <div className="h-3 w-full bg-surface-container rounded" />
          <div className="h-3 w-4/5 bg-surface-container rounded" />
          <div className="flex gap-2 pt-1">
            {[1, 2, 3, 4].map(j => (
              <div key={j} className="h-8 w-24 bg-surface-container rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Single shaping card ──────────────────────────────────────────────────────
function ShapingCard({ item, chosenType, onChoose }) {
  const aiType   = getType(item.recommended_type ?? "Feature");
  const pmType   = getType(chosenType);
  const isOverride = chosenType !== (item.recommended_type ?? "Feature");

  return (
    <div className={`rounded-xl border transition-all shadow-card ${pmType.cardBg}`}>

      {/* Card header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* AI rec badge */}
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface border border-outline text-on-surface-variant">
              <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              AI Recommends:
              <span className={`ml-1 font-extrabold ${aiType.badge.split(" ")[1]}`}>{aiType.label}</span>
            </span>
            {isOverride && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700">
                <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>edit</span>
                PM Override
              </span>
            )}
          </div>
          {/* Chosen type badge (large) */}
          <span className={`shrink-0 flex items-center gap-1.5 text-[12px] font-bold px-3 py-1 rounded-full border ${pmType.badge}`}>
            <span className="material-symbols-outlined text-[13px]">{pmType.icon}</span>
            {pmType.label}
          </span>
        </div>

        {/* Opportunity info */}
        <h3 className="text-base font-headline font-bold text-on-surface mb-2">{item.title}</h3>

        {item.problem_statement && (
          <p className="text-sm text-on-surface-variant leading-relaxed mb-3">{item.problem_statement}</p>
        )}

        {/* AI rationale */}
        {item.rationale && (
          <div className="bg-surface/80 border border-outline rounded-lg px-3 py-2.5 mb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[13px] text-on-surface-variant">info</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">AI Rationale</span>
            </div>
            <p className="text-[12px] text-on-surface-variant leading-relaxed">{item.rationale}</p>
          </div>
        )}

        {/* Scope hint */}
        {item.scope && (
          <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
            <span className="material-symbols-outlined text-[13px]">straighten</span>
            <span className="font-semibold">Scope:</span>
            <span>{item.scope}</span>
          </div>
        )}
      </div>

      {/* Type selector */}
      <div className="px-5 py-3 border-t border-outline/60">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2.5">
          Choose Solution Type
        </p>
        <div className="flex flex-wrap gap-2">
          {ARTIFACT_TYPES.map(type => {
            const isChosen = chosenType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => onChoose(type.id)}
                title={type.description}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all",
                  isChosen
                    ? type.button + " border-transparent shadow-sm"
                    : type.buttonOut + " bg-transparent",
                ].join(" ")}
              >
                <span className="material-symbols-outlined text-[14px]">{type.icon}</span>
                {type.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Summary panel (right, sticky) ───────────────────────────────────────────
function SummaryPanel({ items, chosenTypes, onProceed }) {
  const grouped = useMemo(() => {
    const groups = {};
    ARTIFACT_TYPES.forEach(t => { groups[t.id] = []; });
    items.forEach(item => {
      const type = chosenTypes[item.derived_from_opportunity_id ?? item.id] ?? item.recommended_type ?? "Feature";
      if (groups[type]) groups[type].push(item);
    });
    return groups;
  }, [items, chosenTypes]);

  const total    = items.length;
  const decided  = items.filter(i => (chosenTypes[i.derived_from_opportunity_id ?? i.id])).length;
  const actionable = Object.entries(grouped)
    .filter(([t]) => t !== "No action")
    .reduce((s, [, arr]) => s + arr.length, 0);

  return (
    <div className="bg-surface border border-outline rounded-xl overflow-hidden shadow-card sticky top-[76px]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-outline flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">account_tree</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            Solution Plan
          </span>
        </div>
        <span className="text-[11px] text-on-surface-variant">
          {decided}/{total} shaped
        </span>
      </div>

      {/* Type breakdown */}
      <div className="p-4 space-y-3">
        {ARTIFACT_TYPES.map(type => {
          const count = grouped[type.id]?.length ?? 0;
          if (count === 0) return null;
          const cfg = type;
          return (
            <div key={type.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className="text-[12px] font-semibold text-on-surface">{type.label}</span>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${cfg.countBox}`}>
                  {count}
                </span>
              </div>
              <div className="space-y-1 pl-4">
                {grouped[type.id].map(item => (
                  <div key={item.derived_from_opportunity_id ?? item.id}
                    className="text-[11px] text-on-surface-variant leading-snug truncate">
                    {item.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[12px] text-on-surface-variant">No opportunities to shape yet</p>
          </div>
        )}
      </div>

      {/* Proceed CTA */}
      <div className="px-4 pb-4 pt-0 space-y-2">
        <button
          onClick={onProceed}
          disabled={total === 0}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary-dim transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          Generate Artifacts
        </button>
        {actionable > 0 && (
          <p className="text-[10px] text-on-surface-variant text-center">
            {actionable} artifact{actionable === 1 ? "" : "s"} will be generated
          </p>
        )}
      </div>

      {/* Mini stats */}
      {total > 0 && (
        <div className="border-t border-outline px-4 py-3 grid grid-cols-2 text-center gap-2">
          <div>
            <p className="text-base font-headline font-bold text-on-surface">{actionable}</p>
            <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Actionable</p>
          </div>
          <div>
            <p className="text-base font-headline font-bold text-slate-400">{grouped["No action"]?.length ?? 0}</p>
            <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Deferred</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SolutionShaping({ onNavigate }) {
  // Load approved opportunities from previous step
  const opportunityData = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("opportunity_pipeline_data") ?? "null"); }
    catch { return null; }
  }, []);
  const persistedShapingData = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("shaping_pipeline_data") ?? "null"); }
    catch { return null; }
  }, []);

  const approvedOpps = opportunityData?.opportunities ?? [];

  const [shaping, setShaping]           = useState(false);
  const [shapedItems, setShapedItems]   = useState(() => persistedShapingData?.shaped ?? []);
  const [chosenTypes, setChosenTypes]   = useState(() => persistedShapingData?.chosen_types ?? {});
  const [error, setError]               = useState(null);
  const [jobMessage, setJobMessage]     = useState(null);
  const wsRef = useRef(null);
  const hasAutoStartedRef = useRef(false);

  const [jobId, setJobId] = useState(
    () => sessionStorage.getItem("shaping_job_id") ?? null
  );
  function storeJobId(id) {
    if (id) sessionStorage.setItem("shaping_job_id", id);
    else    sessionStorage.removeItem("shaping_job_id");
    setJobId(id);
  }

  useEffect(() => {
    sessionStorage.setItem(
      "shaping_pipeline_data",
      JSON.stringify({
        shaped: shapedItems,
        chosen_types: chosenTypes,
      })
    );
  }, [chosenTypes, shapedItems]);

  // On mount: reconnect to in-flight job or auto-start if input is ready
  useEffect(() => {
    if (jobId) setShaping(true);
    else if (!hasAutoStartedRef.current && shapedItems.length === 0 && approvedOpps.length > 0) {
      hasAutoStartedRef.current = true;
      runShaping();
    }
    return () => wsRef.current?.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvedOpps.length, jobId, shapedItems.length]);

  // Wire WebSocket whenever jobId changes
  useEffect(() => {
    if (!jobId) return;
    getJob(jobId).then((job) => {
      setJobMessage(job.progress_message ?? null);
      if (job.status === "completed") {
        applyResult(job.result_payload); storeJobId(null); return;
      }
      if (job.status === "failed" || job.status === "cancelled") {
        setError(job.error_message ?? "AI generation failed. Please retry.");
        setShaping(false); storeJobId(null); return;
      }
      setShaping(true);
      connectSocket(jobId);
    }).catch(() => { setShaping(true); connectSocket(jobId); });

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
          setShaping(false); storeJobId(null); ws.close();
        }
      };
      ws.onerror = () => {
        setError("Connection to generation service lost. Please retry.");
        setShaping(false);
        storeJobId(null);
      };
    }
    return () => wsRef.current?.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  function applyResult(payload) {
    if (!Array.isArray(payload?.shaped)) {
      setError("Unexpected response from shaping service — missing `shaped` field.");
      setShaping(false);
      return;
    }
    const items = payload.shaped.map((s, i) => ({
      ...s,
      id: s.id ?? s.derived_from_opportunity_id ?? `shaped-${i}`,
      title: s.title ?? approvedOpps[i]?.title,
      problem_statement: s.problem_statement ?? approvedOpps[i]?.problem_statement,
    }));
    setShapedItems(items);
    const defaults = {};
    items.forEach(item => {
      const key = item.derived_from_opportunity_id ?? item.id;
      defaults[key] = item.recommended_type ?? "Feature";
    });
    setChosenTypes(defaults);
    setShaping(false);
  }

  async function runShaping() {
    wsRef.current?.close();
    storeJobId(null);
    setShaping(true);
    setError(null);
    try {
      const result = await startSolutionShapingJob({ opportunities: approvedOpps });
      const id = result.job?.id;
      if (!id) throw new Error("Job start failed — no job ID returned.");
      storeJobId(id);
      setJobMessage(result.job.progress_message ?? null);
    } catch (e) {
      setError(e.message);
      setShaping(false);
    }
  }

  function handleChoose(itemId, typeId) {
    setChosenTypes(prev => ({ ...prev, [itemId]: typeId }));
  }

  function handleProceed() {
    const confirmed = shapedItems.map(item => {
      const key = item.derived_from_opportunity_id ?? item.id;
      return {
        ...item,
        chosen_type: chosenTypes[key] ?? item.recommended_type ?? "Feature",
      };
    });
    sessionStorage.setItem("shaping_pipeline_data", JSON.stringify({ shaped: confirmed, chosen_types: chosenTypes }));
    persistWorkflowStep("shaping");

    const hasActionable = confirmed.some(s => s.chosen_type !== "No action");

    if (hasActionable) {
      onNavigate?.("artifacts");
    } else {
      // All deferred — nothing to generate
      onNavigate?.("dashboard");
    }
  }

  return (
    <div>
      <PipelineFlowBar
        currentStep="shaping"
        completedSteps={getFlowbarCompletedSteps("shaping")}
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
              <button onClick={() => onNavigate?.("opportunity")} className="hover:text-primary transition-colors">
                Opportunity Validation
              </button>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-on-surface font-semibold">Solution Shaping</span>
            </div>
            <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface mb-2">
              Solution <span className="text-primary">Shaping</span>
            </h2>
            <p className="text-on-surface-variant text-sm max-w-xl leading-relaxed">
              Decide how each approved opportunity should be addressed. AI recommends a solution type —
              you can accept or override. Not every problem needs an initiative.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={runShaping}
              disabled={shaping || approvedOpps.length === 0}
              className="flex items-center gap-2 px-4 py-2 border border-outline rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {shaping ? (
                <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[16px]">refresh</span>
              )}
              Re-analyse
            </button>
          </div>
        </div>

        {/* ── Explanation legend ───────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-6 mb-6 p-4 bg-surface border border-outline rounded-xl shadow-card">
          <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Solution Types:</span>
          {ARTIFACT_TYPES.map(t => (
            <div key={t.id} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${t.dot}`} />
              <span className="text-[11px] text-on-surface-variant font-semibold">{t.label}</span>
              <span className="text-[10px] text-on-surface-variant hidden md:inline">— {t.description}</span>
            </div>
          ))}
        </div>

        {/* ── No data state ───────────────────────────────────────────── */}
        {approvedOpps.length === 0 && !shaping && (
          <div className="flex flex-col items-center justify-center py-20 bg-surface border border-outline rounded-xl shadow-card">
            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[28px] text-amber-500">transform</span>
            </div>
            <h3 className="text-base font-headline font-bold text-on-surface mb-2">No approved opportunities</h3>
            <p className="text-sm text-on-surface-variant text-center max-w-sm leading-relaxed mb-6">
              Return to Opportunity Validation and approve at least one opportunity before shaping solutions.
            </p>
            <button
              onClick={() => onNavigate?.("opportunity")}
              className="flex items-center gap-2 px-4 py-2 border border-outline rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Validation
            </button>
          </div>
        )}

        {/* ── First-load error card ───────────────────────────────────── */}
        {!shaping && error && shapedItems.length === 0 && approvedOpps.length > 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-surface border border-red-100 rounded-xl shadow-card">
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[28px] text-error">cloud_off</span>
            </div>
            <h3 className="text-base font-headline font-bold text-on-surface mb-2">AI service unavailable</h3>
            <p className="text-sm text-on-surface-variant text-center max-w-sm leading-relaxed mb-6">{error}</p>
            <button
              onClick={runShaping}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dim transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Retry
            </button>
          </div>
        )}

        {/* ── Main grid ───────────────────────────────────────────────── */}
        {(shaping || shapedItems.length > 0) && (
          <div className="grid grid-cols-12 gap-8">

            {/* Cards — 8 cols */}
            <div className="col-span-12 lg:col-span-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Opportunity → Solution Type
                  </span>
                  {shapedItems.length > 0 && (
                    <span className="text-[10px] font-bold bg-surface-container text-on-surface-variant border border-outline px-2 py-0.5 rounded-full">
                      {shapedItems.length} to shape
                    </span>
                  )}
                </div>
              </div>

              {shaping && (
                <AIProgressCard
                  headline="Shaping solutions"
                  message={jobMessage ?? "Recommending the right solution type for each of your approved opportunities."}
                />
              )}

              {!shaping && shapedItems.length > 0 && (
                <div className="space-y-4">
                  {shapedItems.map(item => {
                    const key = item.derived_from_opportunity_id ?? item.id;
                    return (
                      <ShapingCard
                        key={key}
                        item={item}
                        chosenType={chosenTypes[key] ?? item.recommended_type ?? "Feature"}
                        onChoose={(typeId) => handleChoose(key, typeId)}
                      />
                    );
                  })}
                </div>
              )}

              {error && shapedItems.length > 0 && (
                <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-error text-[18px] mt-0.5">error</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-700">AI service unavailable</p>
                    <p className="text-[12px] text-red-600 mt-0.5">{error}</p>
                  </div>
                  <button
                    onClick={runShaping}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-semibold transition-all shrink-0"
                  >
                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* Summary — 4 cols */}
            <div className="col-span-12 lg:col-span-4">
              <SummaryPanel
                items={shapedItems}
                chosenTypes={chosenTypes}
                onProceed={handleProceed}
              />
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
