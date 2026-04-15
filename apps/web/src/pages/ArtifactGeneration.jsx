import { useState, useMemo, useEffect, useRef } from "react";
import PipelineFlowBar from "../components/pipeline/PipelineFlowBar";
import { getFlowbarCompletedSteps } from "../api/workflows";
import { approveArtifacts } from "../api/artifacts";
import { startArtifactGenerationJob, getJob, openJobSocket } from "../api/jobs";
import AIProgressCard from "../components/AIProgressCard";
import { persistWorkflowStep } from "../api/workflows";

// ─── Config ───────────────────────────────────────────────────────────────────
const TYPE_CFG = {
  initiative: {
    label: "Initiative", icon: "flag",
    badge:  "bg-purple-100 text-purple-700 border border-purple-200",
    cardBg: "bg-purple-50/40 border-purple-200",
    dot:    "bg-purple-500",
    header: "text-purple-700",
  },
  feature: {
    label: "Feature", icon: "widgets",
    badge:  "bg-blue-100 text-blue-700 border border-blue-200",
    cardBg: "bg-blue-50/40 border-blue-200",
    dot:    "bg-blue-500",
    header: "text-blue-700",
  },
  enhancement: {
    label: "Enhancement", icon: "tune",
    badge:  "bg-amber-100 text-amber-700 border border-amber-200",
    cardBg: "bg-amber-50/40 border-amber-200",
    dot:    "bg-amber-500",
    header: "text-amber-700",
  },
};

const PRIORITY_CFG = {
  high:   "bg-red-50 text-red-600 border border-red-100",
  medium: "bg-amber-50 text-amber-600 border border-amber-100",
  low:    "bg-slate-50 text-slate-500 border border-slate-200",
};

// ─── Shared sub-components ────────────────────────────────────────────────────
function FieldBlock({ label, children }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function BulletList({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant leading-snug">
          <span className="w-1 h-1 rounded-full bg-on-surface-variant/40 shrink-0 mt-2" />
          {item}
        </li>
      ))}
    </ul>
  );
}

// ─── Typed body renderers ─────────────────────────────────────────────────────
function InitiativeBody({ body }) {
  return (
    <>
      {body.desired_outcome && (
        <FieldBlock label="Desired Outcome">
          <p className="text-sm text-on-surface-variant leading-relaxed">{body.desired_outcome}</p>
        </FieldBlock>
      )}
      {body.success_metrics?.length > 0 && (
        <FieldBlock label="Success Metrics">
          <BulletList items={body.success_metrics} />
        </FieldBlock>
      )}
      {(body.scope?.in_scope?.length > 0 || body.scope?.out_of_scope?.length > 0) && (
        <FieldBlock label="Scope">
          {body.scope.in_scope?.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold text-green-600 mb-1">In scope</p>
              <BulletList items={body.scope.in_scope} />
            </div>
          )}
          {body.scope.out_of_scope?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-red-500 mb-1">Out of scope</p>
              <BulletList items={body.scope.out_of_scope} />
            </div>
          )}
        </FieldBlock>
      )}
      {body.assumptions?.length > 0 && (
        <FieldBlock label="Assumptions">
          <BulletList items={body.assumptions} />
        </FieldBlock>
      )}
      {body.risks?.length > 0 && (
        <FieldBlock label="Risks">
          <BulletList items={body.risks} />
        </FieldBlock>
      )}
    </>
  );
}

function FeatureBody({ body }) {
  // Prefer canonical fields; fall back to legacy field names for compatibility
  const problemStatement = body.problem_statement ?? body.user_problem;
  const proposedSolution = body.proposed_solution ?? body.solution_overview;

  return (
    <>
      {problemStatement && (
        <FieldBlock label="Problem Statement">
          <p className="text-sm text-on-surface-variant leading-relaxed">{problemStatement}</p>
        </FieldBlock>
      )}
      {body.user_segment && (
        <FieldBlock label="User Segment">
          <p className="text-sm text-on-surface-variant leading-relaxed">{body.user_segment}</p>
        </FieldBlock>
      )}
      {proposedSolution && (
        <FieldBlock label="Proposed Solution">
          <p className="text-sm text-on-surface-variant leading-relaxed">{proposedSolution}</p>
        </FieldBlock>
      )}
      {body.user_value && (
        <FieldBlock label="User Value">
          <p className="text-sm text-on-surface-variant leading-relaxed">{body.user_value}</p>
        </FieldBlock>
      )}
      {body.business_value && (
        <FieldBlock label="Business Value">
          <p className="text-sm text-on-surface-variant leading-relaxed">{body.business_value}</p>
        </FieldBlock>
      )}
      {body.functional_requirements?.length > 0 && (
        <FieldBlock label="Functional Requirements">
          <BulletList items={body.functional_requirements} />
        </FieldBlock>
      )}
      {body.non_functional_requirements?.length > 0 && (
        <FieldBlock label="Non-functional Requirements">
          <BulletList items={body.non_functional_requirements} />
        </FieldBlock>
      )}
      {body.success_metrics?.length > 0 && (
        <FieldBlock label="Success Metrics">
          <BulletList items={body.success_metrics} />
        </FieldBlock>
      )}
      {body.dependencies?.length > 0 && (
        <FieldBlock label="Dependencies">
          <BulletList items={body.dependencies} />
        </FieldBlock>
      )}
    </>
  );
}

function EnhancementBody({ body }) {
  return (
    <>
      {body.current_capability && (
        <FieldBlock label="Current Capability">
          <p className="text-sm text-on-surface-variant leading-relaxed">{body.current_capability}</p>
        </FieldBlock>
      )}
      {body.current_issue && (
        <FieldBlock label="Current Issue">
          <p className="text-sm text-on-surface-variant leading-relaxed">{body.current_issue}</p>
        </FieldBlock>
      )}
      {body.proposed_improvement && (
        <FieldBlock label="Proposed Improvement">
          <p className="text-sm text-on-surface-variant leading-relaxed">{body.proposed_improvement}</p>
        </FieldBlock>
      )}
      {body.expected_impact && (
        <FieldBlock label="Expected Impact">
          <p className="text-sm text-on-surface-variant leading-relaxed">{body.expected_impact}</p>
        </FieldBlock>
      )}
      {body.affected_surfaces?.length > 0 && (
        <FieldBlock label="Affected Surfaces">
          <div className="flex flex-wrap gap-1.5">
            {body.affected_surfaces.map((s, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full">{s}</span>
            ))}
          </div>
        </FieldBlock>
      )}
    </>
  );
}

// ─── Artifact card ────────────────────────────────────────────────────────────
function ArtifactCard({ artifact, isApproved, isRejected, onApprove, onReject, onUndo }) {
  const [expanded, setExpanded] = useState(false);
  const type = (artifact.artifact_type ?? "feature").toLowerCase();
  const cfg  = TYPE_CFG[type] ?? TYPE_CFG.feature;
  const priorityClass = PRIORITY_CFG[artifact.body?.priority ?? "medium"] ?? PRIORITY_CFG.medium;

  const bodyEl = type === "initiative" ? <InitiativeBody body={artifact.body ?? {}} />
               : type === "enhancement" ? <EnhancementBody body={artifact.body ?? {}} />
               : <FeatureBody body={artifact.body ?? {}} />;

  const cardClass = isApproved ? "border-green-200 bg-green-50/40"
                  : isRejected ? "border-red-100 bg-red-50/20 opacity-60"
                  : cfg.cardBg;

  return (
    <div className={`rounded-xl border transition-all shadow-card ${cardClass}`}>

      {/* Card header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>
              <span className="material-symbols-outlined text-[13px]">{cfg.icon}</span>
              {cfg.label}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface border border-outline text-on-surface-variant">
              AI Generated
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityClass}`}>
              {(artifact.body?.priority ?? "medium")} priority
            </span>
          </div>
          {isApproved && (
            <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-green-600">
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Approved
            </span>
          )}
          {isRejected && (
            <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-red-500">
              <span className="material-symbols-outlined text-[14px]">cancel</span>
              Rejected
            </span>
          )}
        </div>

        <h3 className="text-base font-headline font-bold text-on-surface mb-2">{artifact.title}</h3>
        {artifact.summary && (
          <p className="text-sm text-on-surface-variant leading-relaxed mb-4">{artifact.summary}</p>
        )}

        {/* Template body — with fade + expand */}
        <div className={expanded ? "" : "max-h-48 overflow-hidden relative"}>
          {bodyEl}
          {!expanded && (
            <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-white/80 to-transparent pointer-events-none" />
          )}
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-dim mt-2 transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">{expanded ? "expand_less" : "expand_more"}</span>
          {expanded ? "Collapse spec" : "View full spec"}
        </button>
      </div>

      {/* Actions */}
      {!isApproved && !isRejected && (
        <div className="px-5 py-3 border-t border-outline/60 flex items-center gap-2">
          <button
            onClick={() => onApprove(artifact.artifact_id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-[12px] font-bold rounded-lg hover:bg-primary-dim transition-all"
          >
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Approve
          </button>
          <button
            onClick={() => onReject(artifact.artifact_id)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-outline text-[12px] font-semibold text-on-surface-variant rounded-lg hover:bg-red-50 hover:text-error hover:border-red-100 transition-all ml-auto"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
            Reject
          </button>
        </div>
      )}

      {(isApproved || isRejected) && (
        <div className="px-5 py-3 border-t border-outline/60 flex items-center justify-between">
          <span className={`text-[11px] font-medium ${isApproved ? "text-green-600" : "text-red-500"}`}>
            {isApproved ? "Moving to story slicing" : "Excluded from stories"}
          </span>
          <button
            onClick={() => onUndo(artifact.artifact_id)}
            className="text-[11px] text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[13px]">undo</span>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Type group header ────────────────────────────────────────────────────────
function TypeGroup({ type, count, children }) {
  const cfg = TYPE_CFG[type] ?? TYPE_CFG.feature;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          {cfg.label}s
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{count}</span>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ─── Approved summary panel ───────────────────────────────────────────────────
function ApprovedPanel({ artifacts, approved, rejected, onProceed }) {
  const approvedList   = artifacts.filter(a => approved.has(a.artifact_id));
  const pendingCount   = artifacts.length - approved.size - rejected.size;

  return (
    <div className="bg-surface border border-outline rounded-xl overflow-hidden shadow-card sticky top-[76px]">
      <div className="px-5 py-4 border-b border-outline flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-green-500">verified</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Approved</span>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
          approvedList.length > 0
            ? "bg-green-50 text-green-600 border-green-100"
            : "bg-surface-container text-on-surface-variant border-outline"
        }`}>
          {approvedList.length} / {artifacts.length}
        </span>
      </div>

      <div className="p-4 min-h-[160px]">
        {approvedList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-surface-container border border-outline flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">add_task</span>
            </div>
            <p className="text-[12px] text-on-surface-variant leading-relaxed">
              Approve artifacts to<br />add them to story slicing
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {approvedList.map(a => {
              const type = (a.artifact_type ?? "feature").toLowerCase();
              const cfg  = TYPE_CFG[type] ?? TYPE_CFG.feature;
              return (
                <div key={a.artifact_id} className="flex items-start gap-2.5 p-2.5 bg-green-50/60 border border-green-100 rounded-lg">
                  <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} mt-1.5 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-on-surface leading-snug truncate">{a.title}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 capitalize">{cfg.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={onProceed}
          disabled={approvedList.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary-dim transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
          Slice Into Stories
        </button>
        {approvedList.length > 0 && (
          <p className="text-[10px] text-on-surface-variant text-center mt-2">
            {approvedList.length} artifact{approvedList.length === 1 ? "" : "s"} will be sliced
          </p>
        )}
      </div>

      {artifacts.length > 0 && (
        <div className="border-t border-outline px-4 py-3 grid grid-cols-3 text-center">
          <div>
            <p className="text-base font-headline font-bold text-green-600">{approved.size}</p>
            <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Approved</p>
          </div>
          <div>
            <p className="text-base font-headline font-bold text-on-surface">{pendingCount}</p>
            <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Pending</p>
          </div>
          <div>
            <p className="text-base font-headline font-bold text-red-400">{rejected.size}</p>
            <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Rejected</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function GeneratingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-surface border border-outline rounded-xl p-5 space-y-3 animate-pulse shadow-card">
          <div className="flex gap-2">
            <div className="h-6 w-24 bg-surface-container rounded-full" />
            <div className="h-6 w-20 bg-surface-container rounded-full" />
          </div>
          <div className="h-5 w-2/3 bg-surface-container rounded" />
          <div className="h-3 w-full bg-surface-container rounded" />
          <div className="h-3 w-4/5 bg-surface-container rounded" />
          <div className="space-y-2 pt-2">
            <div className="h-3 w-32 bg-surface-container rounded" />
            <div className="h-3 w-full bg-surface-container rounded" />
            <div className="h-3 w-5/6 bg-surface-container rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ArtifactGeneration({ onNavigate }) {
  const shapingData = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("shaping_pipeline_data") ?? "null"); }
    catch { return null; }
  }, []);
  const persistedArtifactData = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("artifact_pipeline_data") ?? "null"); }
    catch { return null; }
  }, []);

  const [generating, setGenerating] = useState(false);
  const [artifacts, setArtifacts]   = useState(() => persistedArtifactData?.artifacts ?? []);
  const [approved, setApproved]     = useState(() => new Set(persistedArtifactData?.approved_ids ?? []));
  const [rejected, setRejected]     = useState(() => new Set(persistedArtifactData?.rejected_ids ?? []));
  const [error, setError]           = useState(null);
  const [jobMessage, setJobMessage] = useState(null);
  const wsRef = useRef(null);
  const hasAutoStartedRef = useRef(false);

  const [jobId, setJobId] = useState(
    () => sessionStorage.getItem("artifact_job_id") ?? null
  );
  function storeJobId(id) {
    if (id) sessionStorage.setItem("artifact_job_id", id);
    else    sessionStorage.removeItem("artifact_job_id");
    setJobId(id);
  }

  useEffect(() => {
    sessionStorage.setItem(
      "artifact_pipeline_data",
      JSON.stringify({
        artifacts,
        approved_ids: Array.from(approved),
        rejected_ids: Array.from(rejected),
      })
    );
  }, [approved, artifacts, rejected]);

  // On mount: reconnect to in-flight job or auto-start if input is ready
  useEffect(() => {
    if (jobId) setGenerating(true);
    else if (!hasAutoStartedRef.current && artifacts.length === 0 && shapingData?.shaped?.length > 0) {
      hasAutoStartedRef.current = true;
      runGenerate();
    }
    return () => wsRef.current?.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifacts.length, jobId, shapingData?.shaped?.length]);

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
        setGenerating(false); storeJobId(null); return;
      }
      setGenerating(true);
      connectSocket(jobId);
    }).catch(() => { setGenerating(true); connectSocket(jobId); });

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
          setGenerating(false); storeJobId(null); ws.close();
        }
      };
      ws.onerror = () => {
        setError("Connection to generation service lost. Please retry.");
        setGenerating(false);
        storeJobId(null);
      };
    }
    return () => wsRef.current?.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  function applyResult(payload) {
    const items = (payload?.artifacts ?? []).map((a, i) => ({
      ...a,
      artifact_id: a.artifact_id ?? `artifact-${i}`,
    }));
    setArtifacts(items);
    setApproved(new Set());
    setRejected(new Set());
    setGenerating(false);
    storeJobId(null);
  }

  async function runGenerate() {
    wsRef.current?.close();
    storeJobId(null);
    setGenerating(true);
    setError(null);
    setApproved(new Set());
    setRejected(new Set());
    try {
      const result = await startArtifactGenerationJob({ shaped: shapingData?.shaped ?? [] });
      const id = result.job?.id;
      if (!id) throw new Error("Job start failed — no job ID returned.");
      storeJobId(id);
      setJobMessage(result.job.progress_message ?? null);
    } catch (e) {
      setError(e.message);
      setGenerating(false);
    }
  }

  function handleApprove(id) {
    setApproved(prev => new Set([...prev, id]));
    setRejected(prev => { const n = new Set(prev); n.delete(id); return n; });
  }
  function handleReject(id) {
    setRejected(prev => new Set([...prev, id]));
    setApproved(prev => { const n = new Set(prev); n.delete(id); return n; });
  }
  function handleUndo(id) {
    setApproved(prev => { const n = new Set(prev); n.delete(id); return n; });
    setRejected(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  async function handleProceed() {
    const approvedArtifacts = artifacts.filter(a => approved.has(a.artifact_id));
    try {
      const result = await approveArtifacts({
        artifacts,
        approved_ids: approvedArtifacts.map(a => a.artifact_id),
        rejected_ids: Array.from(rejected),
      });
      sessionStorage.setItem(
        "artifact_pipeline_data",
        JSON.stringify({
          artifacts: result.artifacts ?? approvedArtifacts,
          approved_ids: approvedArtifacts.map(a => a.artifact_id),
          rejected_ids: Array.from(rejected),
        })
      );
      persistWorkflowStep("artifacts");
      onNavigate?.("stories");
    } catch (e) {
      setError(e.message);
    }
  }

  // Group by type, preserving Initiative → Feature → Enhancement order
  const grouped = useMemo(() => {
    const g = {};
    artifacts.forEach(a => {
      const t = (a.artifact_type ?? "feature").toLowerCase();
      if (!g[t]) g[t] = [];
      g[t].push(a);
    });
    return g;
  }, [artifacts]);

  const visibleTypes = ["initiative", "feature", "enhancement"].filter(t => grouped[t]?.length > 0);
  const hasData = shapingData?.shaped?.filter(s => s.chosen_type !== "No action").length > 0;

  return (
    <div>
      <PipelineFlowBar
        currentStep="artifacts"
        completedSteps={getFlowbarCompletedSteps("artifacts")}
        onNavigate={onNavigate}
      />

      <div className="px-10 py-10">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1 text-[11px] text-on-surface-variant font-medium">
              <button onClick={() => onNavigate?.("shaping")} className="hover:text-primary transition-colors">
                Solution Shaping
              </button>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-on-surface font-semibold">Artifact Generation</span>
            </div>
            <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface mb-2">
              Artifact <span className="text-primary">Generation</span>
            </h2>
            <p className="text-on-surface-variant text-sm max-w-xl leading-relaxed">
              AI has generated structured artifacts from your shaped solutions. Each artifact renders its own template.
              Review, expand the full spec, then approve what proceeds to story slicing.
            </p>
          </div>
          <button
            onClick={runGenerate}
            disabled={generating || !hasData}
            className="flex items-center gap-2 px-4 py-2 border border-outline rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-all disabled:opacity-40"
          >
            {generating
              ? <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              : <span className="material-symbols-outlined text-[16px]">refresh</span>}
            Regenerate
          </button>
        </div>

        {/* ── No input state ───────────────────────────────────────────── */}
        {!hasData && !generating && (
          <div className="flex flex-col items-center justify-center py-20 bg-surface border border-outline rounded-xl shadow-card">
            <div className="w-14 h-14 rounded-full bg-surface-container border border-outline flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[28px] text-on-surface-variant">auto_awesome</span>
            </div>
            <h3 className="text-base font-headline font-bold text-on-surface mb-2">No shaped solutions found</h3>
            <p className="text-sm text-on-surface-variant text-center max-w-sm leading-relaxed mb-6">
              Return to Solution Shaping and confirm at least one actionable solution first.
            </p>
            <button
              onClick={() => onNavigate?.("shaping")}
              className="flex items-center gap-2 px-4 py-2 border border-outline rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Shaping
            </button>
          </div>
        )}

        {/* ── First-load error card ───────────────────────────────────── */}
        {!generating && error && artifacts.length === 0 && hasData && (
          <div className="flex flex-col items-center justify-center py-20 bg-surface border border-red-100 rounded-xl shadow-card">
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[28px] text-error">cloud_off</span>
            </div>
            <h3 className="text-base font-headline font-bold text-on-surface mb-2">AI service unavailable</h3>
            <p className="text-sm text-on-surface-variant text-center max-w-sm leading-relaxed mb-6">{error}</p>
            <button
              onClick={runGenerate}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dim transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Retry
            </button>
          </div>
        )}

        {/* ── Main grid ───────────────────────────────────────────────── */}
        {(generating || artifacts.length > 0) && (
          <div className="grid grid-cols-12 gap-8">

            {/* Cards — 8 cols */}
            <div className="col-span-12 lg:col-span-8">
              {generating && (
                <AIProgressCard
                  headline="Generating artifacts"
                  message={jobMessage ?? "Building structured Initiative, Feature, and Enhancement drafts from your shaped solutions."}
                />
              )}

              {!generating && visibleTypes.map(type => (
                <TypeGroup key={type} type={type} count={grouped[type].length}>
                  {grouped[type].map(artifact => (
                    <ArtifactCard
                      key={artifact.artifact_id}
                      artifact={artifact}
                      isApproved={approved.has(artifact.artifact_id)}
                      isRejected={rejected.has(artifact.artifact_id)}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onUndo={handleUndo}
                    />
                  ))}
                </TypeGroup>
              ))}

              {error && artifacts.length > 0 && (
                <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-error text-[18px] mt-0.5">error</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-700">Generation failed</p>
                    <p className="text-[12px] text-red-600 mt-0.5">{error}</p>
                  </div>
                  <button
                    onClick={runGenerate}
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
              <ApprovedPanel
                artifacts={artifacts}
                approved={approved}
                rejected={rejected}
                onProceed={handleProceed}
              />
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
