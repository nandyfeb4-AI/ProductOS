import { useEffect, useRef, useState } from "react";
import { getProjects, createProject } from "../api/projects";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  active:    { label: "Active",    badge: "bg-blue-50 text-blue-600 border-blue-100",     stripe: "from-primary via-blue-400 to-blue-300",     icon: "folder_open",    iconBg: "bg-primary/10 border-primary/20",   iconColor: "text-primary"    },
  on_hold:   { label: "On Hold",   badge: "bg-amber-50 text-amber-600 border-amber-100",  stripe: "from-amber-400 via-amber-300 to-amber-200",  icon: "folder",         iconBg: "bg-amber-50 border-amber-100",      iconColor: "text-amber-600"  },
  completed: { label: "Completed", badge: "bg-green-50 text-green-600 border-green-100",  stripe: "from-green-400 to-emerald-300",              icon: "folder_special", iconBg: "bg-green-50 border-green-100",      iconColor: "text-green-600"  },
  archived:  { label: "Archived",  badge: "bg-slate-100 text-slate-500 border-slate-200", stripe: "from-slate-300 to-slate-200",                icon: "folder_off",     iconBg: "bg-slate-100 border-slate-200",     iconColor: "text-slate-400"  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function relativeTime(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-surface border border-outline rounded-2xl overflow-hidden animate-pulse">
      <div className="h-[5px] bg-surface-container" />
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-surface-container shrink-0" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="flex justify-between gap-2">
              <div className="h-4 w-32 bg-surface-container rounded" />
              <div className="h-5 w-14 bg-surface-container rounded-full" />
            </div>
            <div className="h-3 w-20 bg-surface-container rounded" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-full bg-surface-container rounded" />
          <div className="h-3 w-4/5 bg-surface-container rounded" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-11 bg-surface-container rounded-xl" />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="h-3 w-16 bg-surface-container rounded" />
          <div className="h-8 w-20 bg-surface-container rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onOpen }) {
  const cfg     = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active;
  const updated = relativeTime(project.updated_at);
  const hasActivity = (project.workshop_count ?? 0) > 0 || (project.workflow_count ?? 0) > 0;

  const stats = [
    { icon: "groups",       value: project.workshop_count ?? 0, label: "Workshops" },
    { icon: "account_tree", value: project.workflow_count ?? 0, label: "Workflows" },
    { icon: "auto_awesome", value: project.feature_count  ?? 0, label: "Features"  },
    { icon: "receipt_long", value: project.story_count    ?? 0, label: "Stories"   },
  ];

  return (
    <div
      className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-card transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/25 flex flex-col group cursor-pointer"
      onClick={() => onOpen(project)}
    >
      {/* Accent stripe */}
      <div className={`h-[5px] shrink-0 bg-gradient-to-r ${cfg.stripe}`} />

      <div className="p-6 flex flex-col gap-5 flex-1">

        {/* Header: icon + name + badge */}
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border-2 shadow-sm ${cfg.iconBg}`}>
            <span
              className={`material-symbols-outlined text-[22px] ${cfg.iconColor}`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {cfg.icon}
            </span>
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-headline font-bold text-on-surface leading-snug truncate">
                {project.name}
              </p>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 ${cfg.badge}`}>
                {cfg.label}
              </span>
            </div>
            {updated && (
              <p className="text-[11px] text-on-surface-variant mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[11px]">schedule</span>
                {updated}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {project.description ? (
          <p className="text-[12px] text-on-surface-variant leading-relaxed line-clamp-2 -mt-1">
            {project.description}
          </p>
        ) : (
          <p className="text-[12px] text-on-surface-variant/40 italic -mt-1">No description</p>
        )}

        {/* Stats — 2×2 grid */}
        <div className="grid grid-cols-2 gap-2">
          {stats.map(({ icon, value, label }) => (
            <div key={label} className="flex items-center gap-2.5 bg-surface-container border border-outline rounded-xl px-3 py-2.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${cfg.iconBg}`}>
                <span className={`material-symbols-outlined text-[13px] ${cfg.iconColor}`}>{icon}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface leading-none">{value}</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
            <span className={`w-1.5 h-1.5 rounded-full ${hasActivity ? "bg-green-400" : "bg-outline"}`} />
            {hasActivity ? "Active" : "No activity yet"}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(project); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-lg hover:bg-primary-dim transition-all shadow-sm"
          >
            Open
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── New project inline form card ─────────────────────────────────────────────
function NewProjectCard({ onCreated, onCancel }) {
  const [name, setName]       = useState("");
  const [desc, setDesc]       = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const nameRef               = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const project = await createProject({ name: trimmed, description: desc.trim() || undefined, slug: slugify(trimmed) });
      onCreated(project);
    } catch (err) {
      setError(err.message ?? "Failed to create project. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface border-2 border-primary/30 rounded-xl overflow-hidden shadow-card">
      <div className="h-[3px] bg-gradient-to-r from-primary via-blue-400 to-blue-300" />
      <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Project name
          </label>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mobile App Redesign"
            disabled={saving}
            className="w-full px-3 py-2 text-sm font-semibold text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 disabled:opacity-50 transition"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Description <span className="normal-case font-normal tracking-normal">(optional)</span>
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What is this project about?"
            rows={3}
            disabled={saving}
            className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 disabled:opacity-50 resize-none transition"
          />
        </div>
        {error && (
          <p className="text-[12px] text-error flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">error</span>
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dim transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && (
              <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
            {saving ? "Creating…" : "Create Project"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function Projects({ onNavigate }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjects();
      setProjects(Array.isArray(data) ? data : (data.projects ?? []));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCreated(newProject) {
    setShowForm(false);
    onNavigate?.("project-detail", newProject);
  }

  function handleOpen(project) {
    onNavigate?.("project-detail", project);
  }

  return (
    <div className="px-10 py-10">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface mb-2">
            Projects
          </h2>
          <p className="text-sm text-on-surface-variant">
            Manage your product discovery projects and track progress across workflows.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dim transition-all shadow-sm active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Project
          </button>
        )}
      </div>

      <div className="mt-8">

        {/* ── Error banner ── */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
            <span className="material-symbols-outlined text-error text-[18px]">error</span>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button
              onClick={load}
              className="text-xs font-semibold text-red-600 hover:text-red-700 shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : projects.length === 0 && !showForm ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
              <span
                className="material-symbols-outlined text-[32px] text-on-surface-variant"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                folder_open
              </span>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-on-surface mb-1">No projects yet</p>
              <p className="text-[12px] text-on-surface-variant">
                Create your first project to begin organising your product discovery work.
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dim transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Create your first project
            </button>
          </div>
        ) : (
          /* ── Grid ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {showForm && (
              <NewProjectCard
                onCreated={handleCreated}
                onCancel={() => setShowForm(false)}
              />
            )}
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onOpen={handleOpen} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
