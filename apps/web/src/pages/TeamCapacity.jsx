import { useState, useEffect } from "react";
import { getProjectTeam, updateProject } from "../api/projects";

// ─── Placeholder names (assigned by index, since API doesn't provide real names) ─
const PLACEHOLDER_NAMES = [
  "Alex Rivera",
  "Jordan Lee",
  "Sam Chen",
  "Morgan Davis",
  "Taylor Kim",
  "Casey Patel",
  "Riley Thompson",
  "Quinn Martinez",
  "Drew Wilson",
];

// ─── Category normalisation ───────────────────────────────────────────────────
// Collapses raw discipline/role strings into a small set of display categories.
const CATEGORY_STYLE = {
  Engineering: "bg-blue-50 text-blue-700 border-blue-100",
  Design:      "bg-purple-50 text-purple-700 border-purple-100",
  Product:     "bg-teal-50 text-teal-700 border-teal-100",
  QA:          "bg-red-50 text-red-700 border-red-100",
  Data:        "bg-amber-50 text-amber-700 border-amber-100",
  Platform:    "bg-slate-100 text-slate-600 border-slate-200",
  Leadership:  "bg-violet-50 text-violet-700 border-violet-100",
};

function normalizeCategory(member) {
  // Prefer the explicit role name from the API
  const raw = (
    member.role || member.role_title || member.title || member.job_title || member.discipline || ""
  ).toLowerCase();

  if (raw.includes("engineer") || raw.includes("engineering")) return "Engineering";
  if (raw.includes("design"))                                   return "Design";
  if (raw.includes("product"))                                  return "Product";
  if (raw.includes("qa") || raw.includes("quality"))           return "QA";
  if (raw.includes("data"))                                     return "Data";
  if (raw.includes("devops") || raw.includes("platform") || raw.includes("infra")) return "Platform";
  if (raw.includes("lead") || raw.includes("manager") || raw.includes("tech lead")) return "Leadership";
  return null;
}

// ─── Seniority badge ──────────────────────────────────────────────────────────
const SENIORITY_STYLE = {
  junior:    "bg-sky-50 text-sky-600 border-sky-100",
  mid:       "bg-surface-container text-on-surface-variant border-outline",
  senior:    "bg-violet-50 text-violet-700 border-violet-100",
  lead:      "bg-amber-50 text-amber-700 border-amber-100",
  principal: "bg-purple-50 text-purple-700 border-purple-100",
  staff:     "bg-slate-100 text-slate-600 border-slate-200",
};

function initials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Member card ──────────────────────────────────────────────────────────────
function MemberCard({ member, index }) {
  const name      = PLACEHOLDER_NAMES[index] ?? `Member ${index + 1}`;
  const category  = normalizeCategory(member);
  const seniority = (member.seniority || member.level || "").toLowerCase() || null;
  // The specific role title (e.g. "Frontend Engineer") is more informative than just the category
  const roleTitle = member.role || member.role_title || member.title || member.job_title || null;
  const catStyle  = CATEGORY_STYLE[category] ?? "bg-surface-container text-on-surface-variant border-outline";
  const senStyle  = SENIORITY_STYLE[seniority] ?? "bg-surface-container text-on-surface-variant border-outline";

  return (
    <div className="bg-surface rounded-2xl shadow-card border border-outline hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 px-5 py-4 flex items-center gap-4">

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-surface-container border border-outline flex items-center justify-center shrink-0">
        <span className="text-[13px] font-black text-on-surface-variant">{initials(name)}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-headline font-bold text-on-surface truncate">{name}</p>
        {roleTitle && (
          <p className="text-[11px] text-on-surface-variant truncate mt-0.5">{roleTitle}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {category && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${catStyle}`}>
              {category}
            </span>
          )}
          {seniority && (
            <span className={`text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full border ${senStyle}`}>
              {seniority}
            </span>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-52 bg-surface-container rounded-2xl animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-surface border border-outline rounded-2xl animate-pulse px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-surface-container shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 bg-surface-container rounded" />
              <div className="h-2 w-32 bg-surface-container rounded" />
              <div className="h-2 w-16 bg-surface-container rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TeamCapacity({ onNavigate, project }) {
  const projectId = project?.id ?? null;

  const [teamData, setTeamData]               = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState(null);
  const [editingVelocity, setEditingVelocity] = useState(false);
  const [velocityDraft, setVelocityDraft]     = useState("");
  const [savingVelocity, setSavingVelocity]   = useState(false);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    load();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectTeam(projectId);
      setTeamData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit() {
    setVelocityDraft(String(teamData?.average_velocity_per_sprint ?? 24));
    setEditingVelocity(true);
  }

  async function saveVelocity() {
    const val = parseInt(velocityDraft, 10);
    if (isNaN(val) || val < 1) { setEditingVelocity(false); return; }
    setSavingVelocity(true);
    try {
      await updateProject(projectId, { average_velocity_per_sprint: val });
      await load();
      setEditingVelocity(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingVelocity(false);
    }
  }

  // ── No project ───────────────────────────────────────────────────────────────
  if (!projectId) {
    return (
      <div className="px-8 py-8 flex flex-col items-center justify-center gap-4 min-h-[60vh]">
        <div className="w-16 h-16 rounded-2xl bg-surface-container border border-outline flex items-center justify-center">
          <span className="material-symbols-outlined text-[30px] text-on-surface-variant/40">group</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-on-surface mb-1">No project selected</p>
          <p className="text-[12px] text-on-surface-variant">Open a project to view its team and capacity.</p>
        </div>
        <button
          onClick={() => onNavigate?.("projects")}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dim transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">folder_open</span>
          Open a Project
        </button>
      </div>
    );
  }

  const velocity      = teamData?.average_velocity_per_sprint ?? 24;
  const backlogTarget = teamData?.minimum_ready_backlog_target ?? velocity * 2;
  const members       = teamData?.team_members ?? [];

  return (
    <div className="px-8 py-8">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => onNavigate?.("project-detail")}
          className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {project?.name ?? "Project"}
        </button>
        <span className="text-on-surface-variant">·</span>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-teal-100 border border-teal-200 flex items-center justify-center">
            <span className="material-symbols-outlined text-[13px] text-teal-700" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
          </div>
          <h2 className="text-base font-headline font-bold text-on-surface">Team Capacity</h2>
          {members.length > 0 && (
            <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full border border-outline">
              {members.length} members
            </span>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined text-error text-[18px]">error</span>
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-semibold text-red-600 shrink-0">Dismiss</button>
        </div>
      )}

      {loading ? <LoadingSkeleton /> : (
        <>

          {/* ── Capacity panel ── */}
          <div className="relative overflow-hidden rounded-2xl mb-8 bg-slate-900 shadow-xl">
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-teal-600/20 via-transparent to-blue-600/20 pointer-events-none" />

            <div className="relative z-10 grid grid-cols-[1fr_auto_1fr]">

              {/* Velocity */}
              <div className="px-10 py-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400 mb-0.5">Sprint Velocity</p>
                    <p className="text-[11px] text-slate-400">Average story points per sprint</p>
                  </div>
                  {!editingVelocity && (
                    <button
                      onClick={startEdit}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-bold text-white/70 hover:text-white transition-all"
                    >
                      <span className="material-symbols-outlined text-[12px]">edit</span>
                      Edit
                    </button>
                  )}
                </div>

                {editingVelocity ? (
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="number"
                      min="1"
                      max="999"
                      autoFocus
                      value={velocityDraft}
                      onChange={(e) => setVelocityDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")  saveVelocity();
                        if (e.key === "Escape") setEditingVelocity(false);
                      }}
                      className="w-28 px-3 py-2 bg-white/10 border border-teal-500/40 rounded-xl text-4xl font-black text-white text-center focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                    />
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={saveVelocity}
                        disabled={savingVelocity}
                        className="flex items-center gap-1 px-3 py-1.5 bg-teal-500 text-white text-[11px] font-bold rounded-lg hover:bg-teal-400 transition-all disabled:opacity-40"
                      >
                        {savingVelocity
                          ? <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                          : <span className="material-symbols-outlined text-[12px]">check</span>
                        }
                        Save
                      </button>
                      <button
                        onClick={() => setEditingVelocity(false)}
                        className="px-3 py-1 text-[11px] text-slate-400 hover:text-white transition-colors text-center"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[80px] font-black text-white leading-none tracking-tight font-headline">{velocity}</p>
                    <p className="text-[13px] text-slate-400 mt-2">points / sprint</p>
                  </>
                )}
              </div>

              {/* Divider */}
              <div className="flex flex-col items-center justify-center px-8 py-8 gap-3">
                <div className="w-px flex-1 bg-white/10" />
                <div className="w-11 h-11 rounded-full bg-white/8 border border-white/15 flex items-center justify-center">
                  <span className="text-[13px] font-black text-white/60">×2</span>
                </div>
                <div className="w-px flex-1 bg-white/10" />
              </div>

              {/* Backlog target */}
              <div className="px-10 py-8">
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-0.5">Ready Backlog Target</p>
                  <p className="text-[11px] text-slate-400">Minimum story points in ready state</p>
                </div>
                <p className="text-[80px] font-black text-white leading-none tracking-tight font-headline">{backlogTarget}</p>
                <p className="text-[13px] text-slate-400 mt-2">
                  points&nbsp;·&nbsp;derived as&nbsp;
                  <span className="text-blue-400 font-semibold">2 × {velocity}</span>
                </p>
              </div>

            </div>

            <div className="relative z-10 border-t border-white/8 px-10 py-3 flex items-center gap-6">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="material-symbols-outlined text-[13px]">info</span>
                Velocity is the single editable input — backlog target updates automatically.
              </div>
            </div>
          </div>

          {/* ── Team members ── */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h3 className="text-base font-headline font-bold text-on-surface">Team</h3>
              <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full border border-outline">{members.length}</span>
              <span className="ml-auto text-[11px] text-on-surface-variant">Read-only · team composition managed separately</span>
            </div>

            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 border-2 border-dashed border-outline rounded-2xl">
                <div className="w-14 h-14 rounded-2xl bg-surface-container border border-outline flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px] text-on-surface-variant/40">group</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-on-surface mb-1">No team members yet</p>
                  <p className="text-[12px] text-on-surface-variant">Team members appear here once seeded for this project.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((member, i) => (
                  <MemberCard key={member.id ?? i} member={member} index={i} />
                ))}
              </div>
            )}
          </div>

        </>
      )}

    </div>
  );
}
