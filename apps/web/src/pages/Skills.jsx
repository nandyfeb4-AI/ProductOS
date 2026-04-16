import { useEffect, useMemo, useRef, useState } from "react";
import { createSkill, getSkills, updateSkill } from "../api/skills";

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

const DEFAULT_FEATURE_SPEC_SKILL = {
  name: "Default Feature Spec Skill",
  slug: "default-feature-spec-skill",
  skill_type: "feature_spec",
  description: "Default ProductOS skill for writing a PM-ready feature spec from discovery inputs.",
  is_active: true,
  instructions:
    "Write one PM-ready feature spec grounded in the provided source material. Keep it concrete, delivery-oriented, and concise. Emphasize the user problem, the proposed solution, and the requirements needed to make it implementation-ready.",
  required_sections: [
    "problem_statement",
    "user_segment",
    "proposed_solution",
    "user_value",
    "business_value",
    "functional_requirements",
    "non_functional_requirements",
    "dependencies",
    "success_metrics",
    "priority",
  ],
  quality_bar: [
    "Ground the output in the provided input",
    "Avoid vague platform-language",
    "Make requirements actionable for downstream story generation",
    "Capture meaningful success metrics",
    "Do not turn the output into a PRD",
  ],
  integration_notes: [
    "This skill should map cleanly to the existing Jira epic/feature export structure",
    "Functional requirements should be ready for story generation input",
  ],
};

function TagEditor({ label, hint, values, onChange }) {
  const [draft, setDraft] = useState("");

  function addValue() {
    const value = draft.trim();
    if (!value) return;
    onChange([...(values ?? []), value]);
    setDraft("");
  }

  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
        {label}
      </label>
      {(values ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-[11px] font-semibold rounded-full border border-primary/20"
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((_, i) => i !== index))}
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
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addValue();
            }
          }}
          placeholder={hint}
          className="flex-1 px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40 transition"
        />
        <button
          type="button"
          onClick={addValue}
          className="px-3 py-2 bg-surface border border-outline rounded-lg text-sm font-semibold text-on-surface hover:border-primary hover:text-primary transition"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default function Skills() {
  const [skills, setSkills] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(DEFAULT_FEATURE_SPEC_SKILL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const [message, setMessage] = useState(null);
  const msgTimer              = useRef(null);

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedId) ?? null,
    [skills, selectedId]
  );

  useEffect(() => {
    loadSkills();
  }, []);

  useEffect(() => {
    if (!selectedSkill) return;
    setDraft({
      name: selectedSkill.name ?? "",
      slug: selectedSkill.slug ?? "",
      skill_type: selectedSkill.skill_type ?? "feature_spec",
      description: selectedSkill.description ?? "",
      is_active: selectedSkill.is_active ?? true,
      instructions: selectedSkill.instructions ?? "",
      required_sections: selectedSkill.required_sections ?? [],
      quality_bar: selectedSkill.quality_bar ?? [],
      integration_notes: selectedSkill.integration_notes ?? [],
    });
  }, [selectedSkill]);

  async function loadSkills() {
    setLoading(true);
    setError(null);
    try {
      const result = await getSkills("feature_spec", null);
      const rows = Array.isArray(result) ? result : (result.skills ?? []);
      setSkills(rows);
      const preferred = rows.find((skill) => skill.is_active) ?? rows[0] ?? null;
      setSelectedId(preferred?.id ?? null);
      if (!preferred) {
        setDraft(DEFAULT_FEATURE_SPEC_SKILL);
      }
    } catch (err) {
      setError(err.message ?? "Failed to load skills.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (selectedSkill) {
        const updated = await updateSkill(selectedSkill.id, {
          name: draft.name.trim(),
          description: draft.description.trim(),
          instructions: draft.instructions.trim(),
          required_sections: draft.required_sections,
          quality_bar: draft.quality_bar,
          integration_notes: draft.integration_notes,
          is_active: true,
        });
        setSkills((current) => current.map((skill) => (skill.id === updated.id ? updated : skill)));
        setSelectedId(updated.id);
      } else {
        const created = await createSkill({
          ...draft,
          name: draft.name.trim(),
          slug: slugify(draft.name || "feature-spec-skill"),
          description: draft.description.trim(),
          instructions: draft.instructions.trim(),
          is_active: true,
        });
        setSkills([created]);
        setSelectedId(created.id);
      }
      clearTimeout(msgTimer.current);
      setMessage("Skill saved successfully.");
      msgTimer.current = setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err.message ?? "Failed to save skill.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-10 py-10">
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface mb-2">Skills</h2>
        <p className="text-sm text-on-surface-variant max-w-3xl">
          Skills define how ProductOS agents should work. The Feature Generator agent and workshop feature artifact generation
          both use the active Feature Spec Skill automatically.
        </p>
      </div>

      {loading ? (
        <div className="bg-surface border border-outline rounded-2xl p-6 animate-pulse">
          <div className="h-4 w-40 bg-surface-container rounded mb-3" />
          <div className="h-3 w-96 bg-surface-container rounded mb-6" />
          <div className="h-64 bg-surface-container rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6">
          <div className="bg-surface border border-outline rounded-2xl p-4 h-fit shadow-card">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
              Available Skills
            </p>
            <div className="space-y-3">
              {(skills.length > 0 ? skills : [DEFAULT_FEATURE_SPEC_SKILL]).map((skill, index) => {
                const isSelected = (skill.id ?? `default-${index}`) === (selectedId ?? `default-${index}`);
                return (
                  <button
                    key={skill.id ?? `default-${index}`}
                    onClick={() => setSelectedId(skill.id ?? null)}
                    className={[
                      "w-full text-left border rounded-xl p-4 transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-outline bg-surface hover:border-primary/25",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-headline font-bold text-on-surface">{skill.name}</p>
                        <p className="text-[11px] text-on-surface-variant mt-1 line-clamp-2">{skill.description}</p>
                      </div>
                      {(skill.is_active ?? true) && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-green-50 text-green-600 border-green-100 shrink-0">
                          Active
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSave} className="bg-surface border border-outline rounded-2xl p-6 shadow-card space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                  Skill Configuration
                </p>
                <p className="text-sm text-on-surface-variant">
                  Changes here affect the Feature Generator agent and workflow feature artifact generation.
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-violet-50 text-violet-600 border-violet-100">
                Feature Spec
              </span>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl">
                <span className="material-symbols-outlined text-error text-[16px]">error</span>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {message && (
              <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-100 rounded-xl">
                <span className="material-symbols-outlined text-green-600 text-[16px]">check_circle</span>
                <p className="text-sm text-green-700">{message}</p>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                Skill Name
              </label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm font-semibold text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                Description
              </label>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none transition"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                Instructions
              </label>
              <textarea
                value={draft.instructions}
                onChange={(e) => setDraft((current) => ({ ...current, instructions: e.target.value }))}
                rows={9}
                className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none transition"
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <TagEditor
                label="Required Sections"
                hint="Add required body sections"
                values={draft.required_sections}
                onChange={(value) => setDraft((current) => ({ ...current, required_sections: value }))}
              />
              <TagEditor
                label="Quality Bar"
                hint="Add quality expectations"
                values={draft.quality_bar}
                onChange={(value) => setDraft((current) => ({ ...current, quality_bar: value }))}
              />
            </div>

            <TagEditor
              label="Integration Notes"
              hint="Add downstream Jira/export notes"
              values={draft.integration_notes}
              onChange={(value) => setDraft((current) => ({ ...current, integration_notes: value }))}
            />

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving || !draft.name.trim() || !draft.instructions.trim()}
                className="flex items-center gap-2 px-5 py-3 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dim transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                {saving ? "Saving…" : "Save Skill"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
