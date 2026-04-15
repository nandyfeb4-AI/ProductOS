import { useState, useMemo, useEffect, useRef } from "react";
import PipelineFlowBar from "../components/pipeline/PipelineFlowBar";
import { getFlowbarCompletedSteps } from "../api/workflows";
import { approveStories } from "../api/stories";
import { startStorySlicingJob, getJob, openJobSocket } from "../api/jobs";
import AIProgressCard from "../components/AIProgressCard";
import { persistWorkflowStep } from "../api/workflows";

// ─── Config ───────────────────────────────────────────────────────────────────
const PRIORITY_CFG = {
  high:   "bg-red-50 text-red-600 border border-red-100",
  medium: "bg-amber-50 text-amber-600 border border-amber-100",
  low:    "bg-slate-50 text-slate-500 border border-slate-200",
};

const ARTIFACT_TYPE_CFG = {
  initiative:  { label: "Initiative",  icon: "flag",    badge: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  feature:     { label: "Feature",     icon: "widgets", badge: "bg-blue-100 text-blue-700 border-blue-200",        dot: "bg-blue-500"   },
  enhancement: { label: "Enhancement", icon: "tune",    badge: "bg-amber-100 text-amber-700 border-amber-200",     dot: "bg-amber-500"  },
};

// ─── Story card ───────────────────────────────────────────────────────────────
function StoryCard({ story, isApproved, isRejected, onApprove, onReject, onUndo }) {
  const [expanded, setExpanded] = useState(false);
  const priorityClass = PRIORITY_CFG[story.priority ?? "medium"] ?? PRIORITY_CFG.medium;
  const hasExtra = (story.edge_cases?.length ?? 0) + (story.dependencies?.length ?? 0) > 0;

  return (
    <div className={[
      "rounded-xl border transition-all shadow-card",
      isApproved ? "border-green-200 bg-green-50/40"
      : isRejected ? "border-red-100 bg-red-50/20 opacity-60"
      : "border-outline bg-surface hover:border-primary/20",
    ].join(" ")}>

      <div className="p-4 pb-3">
        {/* Meta row */}
        <div className="flex items-center gap-2 mb-2.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityClass}`}>
            {story.priority ?? "medium"}
          </span>
          {isApproved && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-green-600">
              <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Approved
            </span>
          )}
          {isRejected && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-500">
              <span className="material-symbols-outlined text-[12px]">cancel</span>
              Rejected
            </span>
          )}
        </div>

        {/* Title */}
        <h4 className="text-sm font-headline font-bold text-on-surface mb-3 leading-snug">{story.title}</h4>

        {/* User story block — structured or fallback */}
        {(story.as_a || story.i_want || story.so_that || story.user_story) && (
          <div className="mb-3 bg-surface-container border border-outline rounded-lg px-3.5 py-3 space-y-1.5">
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
              <p className="text-[12px] text-on-surface-variant leading-relaxed italic">{story.user_story}</p>
            )}
          </div>
        )}

        {/* Description / context */}
        {story.description && (
          <p className="text-[12px] text-on-surface-variant leading-relaxed mb-3">{story.description}</p>
        )}

        {/* Acceptance criteria */}
        {story.acceptance_criteria?.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              Acceptance Criteria
            </p>
            <ul className="space-y-1.5">
              {story.acceptance_criteria.map((crit, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                  <span className="material-symbols-outlined text-[13px] text-on-surface-variant/50 mt-0.5 shrink-0">
                    check_box_outline_blank
                  </span>
                  {crit}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Expandable: edge cases + dependencies */}
        {expanded && (
          <>
            {story.edge_cases?.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Edge Cases</p>
                <ul className="space-y-1">
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
              <div className="mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Dependencies</p>
                <div className="flex flex-wrap gap-1.5">
                  {story.dependencies.map((dep, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 bg-surface-container border border-outline rounded text-on-surface-variant">
                      {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {hasExtra && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-dim transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">{expanded ? "expand_less" : "expand_more"}</span>
            {expanded ? "Less detail" : `${(story.edge_cases?.length ?? 0) + (story.dependencies?.length ?? 0)} more details`}
          </button>
        )}
      </div>

      {/* Actions */}
      {!isApproved && !isRejected && (
        <div className="px-4 py-2.5 border-t border-outline/60 flex items-center gap-2">
          <button
            onClick={() => onApprove(story.story_id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-[12px] font-bold rounded-lg hover:bg-primary-dim transition-all"
          >
            <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Approve
          </button>
          <button
            onClick={() => onReject(story.story_id)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-outline text-[12px] font-semibold text-on-surface-variant rounded-lg hover:bg-red-50 hover:text-error hover:border-red-100 transition-all ml-auto"
          >
            <span className="material-symbols-outlined text-[13px]">close</span>
            Reject
          </button>
        </div>
      )}

      {(isApproved || isRejected) && (
        <div className="px-4 py-2.5 border-t border-outline/60 flex items-center justify-between">
          <span className={`text-[11px] font-medium ${isApproved ? "text-green-600" : "text-red-500"}`}>
            {isApproved ? "Moving to Jira export" : "Excluded from export"}
          </span>
          <button
            onClick={() => onUndo(story.story_id)}
            className="text-[11px] text-on-surface-variant hover:text-on-surface flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[13px]">undo</span>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Artifact group container ─────────────────────────────────────────────────
function ArtifactGroup({ artifact, stories, approved, rejected, onApprove, onReject, onUndo }) {
  const [collapsed, setCollapsed] = useState(false);
  const type = (artifact.artifact_type ?? "feature").toLowerCase();
  const cfg  = ARTIFACT_TYPE_CFG[type] ?? ARTIFACT_TYPE_CFG.feature;
  const approvedCount = stories.filter(s => approved.has(s.story_id)).length;

  return (
    <div className="bg-surface border border-outline rounded-xl overflow-hidden shadow-card mb-6">
      <div
        className="flex items-center justify-between px-5 py-4 border-b border-outline cursor-pointer hover:bg-surface-container/50 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
            <span className="material-symbols-outlined text-[12px]">{cfg.icon}</span>
            {cfg.label}
          </span>
          <span className="text-sm font-headline font-bold text-on-surface">{artifact.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
            approvedCount > 0
              ? "bg-green-50 text-green-600 border-green-100"
              : "text-on-surface-variant border-outline bg-surface-container"
          }`}>
            {approvedCount} / {stories.length}
          </span>
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
            {collapsed ? "expand_more" : "expand_less"}
          </span>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-3">
          {stories.map(story => (
            <StoryCard
              key={story.story_id}
              story={story}
              isApproved={approved.has(story.story_id)}
              isRejected={rejected.has(story.story_id)}
              onApprove={onApprove}
              onReject={onReject}
              onUndo={onUndo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StorySlicing({ onNavigate }) {
  const artifactData = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("artifact_pipeline_data") ?? "null"); }
    catch { return null; }
  }, []);
  const persistedStoriesData = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("stories_pipeline_data") ?? "null"); }
    catch { return null; }
  }, []);

  const artifacts = artifactData?.artifacts ?? [];

  const [slicing, setSlicing]       = useState(false);
  const [stories, setStories]       = useState(() => persistedStoriesData?.stories ?? []);
  const [approved, setApproved]     = useState(() => new Set(persistedStoriesData?.approved_ids ?? []));
  const [rejected, setRejected]     = useState(() => new Set(persistedStoriesData?.rejected_ids ?? []));
  const [error, setError]           = useState(null);
  const [jobMessage, setJobMessage] = useState(null);
  const wsRef = useRef(null);
  const hasAutoStartedRef = useRef(false);

  // jobId is persisted to sessionStorage so navigation away and back reconnects
  // to the same in-flight job instead of starting a new one.
  const [jobId, setJobId] = useState(
    () => sessionStorage.getItem("slicing_job_id") ?? null
  );
  function storeJobId(id) {
    if (id) sessionStorage.setItem("slicing_job_id", id);
    else    sessionStorage.removeItem("slicing_job_id");
    setJobId(id);
  }

  useEffect(() => {
    sessionStorage.setItem(
      "stories_pipeline_data",
      JSON.stringify({
        stories,
        approved_ids: Array.from(approved),
        rejected_ids: Array.from(rejected),
      })
    );
  }, [approved, rejected, stories]);

  // On mount: reconnect to an existing in-flight job if one is stored,
  // otherwise auto-start only when there is no persisted job.
  useEffect(() => {
    if (!jobId && !hasAutoStartedRef.current && stories.length === 0 && artifacts.length > 0) {
      hasAutoStartedRef.current = true;
      runSlice();
    }
    return () => wsRef.current?.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifacts.length, jobId, stories.length]);

  // Connect WebSocket whenever we get a job ID (new or restored from storage)
  useEffect(() => {
    if (!jobId) return;

    // Snapshot current state first — also the reconnect path after navigation
    getJob(jobId).then((job) => {
      setJobMessage(job.progress_message ?? null);
      if (job.status === "completed") {
        applyResult(job.result_payload);
        storeJobId(null);
        return;
      }
      if (job.status === "failed" || job.status === "cancelled") {
        setError(job.error_message ?? "AI generation failed. Please retry.");
        setSlicing(false);
        storeJobId(null);
        return;
      }
      // queued or running — attach to the live stream
      setSlicing(true);
      connectSocket(jobId);
    }).catch(() => {
      // snapshot unavailable — try socket directly
      setSlicing(true);
      connectSocket(jobId);
    });

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
          setError(job.error_message ?? "AI generation failed. Please retry.");
          setSlicing(false);
          ws.close();
        }
      };

      ws.onerror = () => {
        setError("Connection to generation service lost. Please retry.");
        setSlicing(false);
        storeJobId(null);
      };
    }

    return () => wsRef.current?.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  function applyResult(payload) {
    const items = (payload?.stories ?? []).map((s, i) => ({
      ...s,
      story_id: s.story_id ?? `story-${i}`,
    }));
    setStories(items);
    setApproved(new Set());
    setRejected(new Set());
    setSlicing(false);
    storeJobId(null); // job is done — no reason to reconnect on future navigations
  }

  async function runSlice() {
    wsRef.current?.close();
    storeJobId(null);
    setSlicing(true);
    setError(null);
    setJobMessage(null);
    setApproved(new Set());
    setRejected(new Set());
    try {
      const result = await startStorySlicingJob({ artifacts });
      const id = result.job?.id;
      if (!id) throw new Error("Job start failed — no job ID returned.");
      storeJobId(id);
      setJobMessage(result.job.progress_message ?? null);
    } catch (e) {
      setError(e.message);
      setSlicing(false);
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

  async function handleExport() {
    const approvedStories = stories.filter(s => approved.has(s.story_id));
    try {
      const result = await approveStories({
        stories,
        approved_ids: approvedStories.map(s => s.story_id),
        rejected_ids: Array.from(rejected),
      });
      sessionStorage.setItem(
        "stories_pipeline_data",
        JSON.stringify({
          stories: result.stories ?? approvedStories,
          approved_ids: approvedStories.map(s => s.story_id),
          rejected_ids: Array.from(rejected),
        })
      );
      persistWorkflowStep("stories");
      onNavigate?.("jira");
    } catch (e) {
      setError(e.message);
    }
  }

  // Group stories by parent artifact
  const storiesByArtifact = useMemo(() => {
    const map = {};
    stories.forEach(s => {
      const key = s.derived_from_artifact_id ?? "unlinked";
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [stories]);

  const approvedCount = approved.size;
  const totalCount    = stories.length;

  return (
    <div>
      <PipelineFlowBar
        currentStep="stories"
        completedSteps={getFlowbarCompletedSteps("stories")}
        onNavigate={onNavigate}
      />

      <div className="px-10 py-10">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1 text-[11px] text-on-surface-variant font-medium">
              <button onClick={() => onNavigate?.("artifacts")} className="hover:text-primary transition-colors">
                Artifact Generation
              </button>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-on-surface font-semibold">Story Slicing</span>
            </div>
            <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface mb-2">
              Story <span className="text-primary">Slicing</span>
            </h2>
            <p className="text-on-surface-variant text-sm max-w-xl leading-relaxed">
              Approved artifacts have been sliced into implementation-ready stories. Each story is traceable to its parent artifact.
              Review acceptance criteria, then approve for Jira export.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {stories.length > 0 && (
              <div className="px-3 py-2 bg-surface border border-outline rounded-lg">
                <span className="text-[12px] font-semibold text-on-surface-variant">
                  {approvedCount} / {totalCount} approved
                </span>
              </div>
            )}
            <button
              onClick={runSlice}
              disabled={slicing || artifacts.length === 0}
              className="flex items-center gap-2 px-4 py-2 border border-outline rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-all disabled:opacity-40"
            >
              {slicing
                ? <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-[16px]">refresh</span>}
              Re-slice
            </button>
          </div>
        </div>

        {/* ── No input state ───────────────────────────────────────────── */}
        {artifacts.length === 0 && !slicing && (
          <div className="flex flex-col items-center justify-center py-20 bg-surface border border-outline rounded-xl shadow-card">
            <div className="w-14 h-14 rounded-full bg-surface-container border border-outline flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[28px] text-on-surface-variant">format_list_bulleted</span>
            </div>
            <h3 className="text-base font-headline font-bold text-on-surface mb-2">No approved artifacts found</h3>
            <p className="text-sm text-on-surface-variant text-center max-w-sm leading-relaxed mb-6">
              Return to Artifact Generation and approve at least one artifact before slicing stories.
            </p>
            <button
              onClick={() => onNavigate?.("artifacts")}
              className="flex items-center gap-2 px-4 py-2 border border-outline rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Artifacts
            </button>
          </div>
        )}

        {/* ── First-load error card ───────────────────────────────────── */}
        {!slicing && error && stories.length === 0 && artifacts.length > 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-surface border border-red-100 rounded-xl shadow-card">
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[28px] text-error">cloud_off</span>
            </div>
            <h3 className="text-base font-headline font-bold text-on-surface mb-2">AI service unavailable</h3>
            <p className="text-sm text-on-surface-variant text-center max-w-sm leading-relaxed mb-6">{error}</p>
            <button
              onClick={runSlice}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dim transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Retry
            </button>
          </div>
        )}

        {/* ── In-progress card (non-blocking) ─────────────────────────── */}
        {slicing && (
          <AIProgressCard
            headline="Generating implementation-ready stories"
            message={jobMessage ?? "We're slicing your approved artifacts into delivery-ready stories. This can take 30–60 seconds because ProductOS is optimising for quality, not shortcuts."}
          />
        )}

        {/* ── Main grid ───────────────────────────────────────────────── */}
        {!slicing && stories.length > 0 && (
          <div className="grid grid-cols-12 gap-8">

            {/* Stories — 8 cols */}
            <div className="col-span-12 lg:col-span-8">
              {artifacts.map(artifact => {
                const group = storiesByArtifact[artifact.artifact_id] ?? [];
                if (group.length === 0) return null;
                return (
                  <ArtifactGroup
                    key={artifact.artifact_id}
                    artifact={artifact}
                    stories={group}
                    approved={approved}
                    rejected={rejected}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onUndo={handleUndo}
                  />
                );
              })}
              {storiesByArtifact["unlinked"]?.length > 0 && (
                <div className="space-y-3">
                  {storiesByArtifact["unlinked"].map(story => (
                    <StoryCard
                      key={story.story_id}
                      story={story}
                      isApproved={approved.has(story.story_id)}
                      isRejected={rejected.has(story.story_id)}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onUndo={handleUndo}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Summary panel — 4 cols */}
            <div className="col-span-12 lg:col-span-4">
              <div className="bg-surface border border-outline rounded-xl overflow-hidden shadow-card sticky top-[76px]">
                <div className="px-5 py-4 border-b border-outline">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Export Plan</span>
                </div>

                <div className="p-4">
                  {approvedCount === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="w-10 h-10 rounded-full bg-surface-container border border-outline flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">add_task</span>
                      </div>
                      <p className="text-[12px] text-on-surface-variant leading-relaxed">
                        Approve stories to add them<br />to the export queue
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {artifacts.map(artifact => {
                        const group = storiesByArtifact[artifact.artifact_id] ?? [];
                        const count = group.filter(s => approved.has(s.story_id)).length;
                        if (count === 0) return null;
                        const type = (artifact.artifact_type ?? "feature").toLowerCase();
                        const cfg  = ARTIFACT_TYPE_CFG[type] ?? ARTIFACT_TYPE_CFG.feature;
                        return (
                          <div key={artifact.artifact_id} className="p-3 bg-green-50/60 border border-green-100 rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold text-on-surface truncate">{artifact.title}</span>
                              <span className="text-[10px] font-bold text-green-600 shrink-0 ml-2">{count} stories</span>
                            </div>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.badge}`}>{cfg.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="px-4 pb-4">
                  <button
                    onClick={handleExport}
                    disabled={approvedCount === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary-dim transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                    Export to Jira
                  </button>
                  {approvedCount > 0 && (
                    <p className="text-[10px] text-on-surface-variant text-center mt-2">
                      {approvedCount} stor{approvedCount === 1 ? "y" : "ies"} ready for export
                    </p>
                  )}
                </div>

                {totalCount > 0 && (
                  <div className="border-t border-outline px-4 py-3 grid grid-cols-3 text-center">
                    <div>
                      <p className="text-base font-headline font-bold text-on-surface">{totalCount}</p>
                      <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Total</p>
                    </div>
                    <div>
                      <p className="text-base font-headline font-bold text-green-600">{approvedCount}</p>
                      <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Approved</p>
                    </div>
                    <div>
                      <p className="text-base font-headline font-bold text-red-400">{rejected.size}</p>
                      <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Rejected</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {error && stories.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
            <span className="material-symbols-outlined text-error text-[18px] mt-0.5">error</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">Story slicing failed</p>
              <p className="text-[12px] text-red-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={runSlice}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-semibold transition-all shrink-0"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
