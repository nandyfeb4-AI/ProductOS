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

const DEFAULT_STORY_SPEC_SKILL = {
  name: "Default Story Spec Skill",
  slug: "default-story-spec-skill",
  skill_type: "story_spec",
  description: "Default ProductOS skill for writing actionable user stories from a feature spec.",
  is_active: true,
  instructions:
    "Write clear, actionable user stories from the provided feature input. Each story should follow the As a / I want / So that format and include acceptance criteria that are testable and implementation-ready. Keep each story independently deliverable where possible.",
  required_sections: [
    "user_story",
    "acceptance_criteria",
    "edge_cases",
    "dependencies",
  ],
  quality_bar: [
    "Follow As a / I want / So that format",
    "Acceptance criteria must be testable and concrete",
    "Keep each story independently deliverable where possible",
    "Surface edge cases that affect implementation",
    "Avoid duplicating the feature spec — write stories, not specs",
  ],
  integration_notes: [
    "Stories should map to Jira story issue type",
    "Acceptance criteria should be usable as Jira description content",
    "Functional requirements from the feature spec drive the story count",
  ],
};

const DEFAULT_STORY_REFINEMENT_SKILL = {
  name: "Default Story Refinement Skill",
  slug: "default-story-refinement-skill",
  skill_type: "story_refinement",
  description: "Default ProductOS skill for evaluating and refining existing user stories.",
  is_active: true,
  instructions:
    "Evaluate each provided user story against the quality bar, then produce a refined version. Maintain the original intent while improving clarity, testability of acceptance criteria, and independent deliverability. Return both an evaluation and a refined story for each input.",
  required_sections: [
    "user_story",
    "acceptance_criteria",
    "evaluation_score",
    "gaps",
    "strengths",
    "refinement_summary",
  ],
  quality_bar: [
    "User story must follow As a / I want / So that format",
    "Acceptance criteria must be specific and testable",
    "Each story should be independently deliverable",
    "Surface gaps that were present in the original",
    "Document strengths that should be preserved",
  ],
  integration_notes: [
    "Refined stories should update the persisted project story record",
    "Evaluation scores and gaps should be surfaced in the UI result view",
    "Story Slicer should be able to operate cleanly on refined stories",
  ],
};

const DEFAULT_STORY_SLICING_SKILL = {
  name: "Default Story Slicing Skill",
  slug: "default-story-slicing-skill",
  skill_type: "story_slicing",
  description: "Default ProductOS skill for decomposing a large user story into smaller, independently deliverable child stories.",
  is_active: true,
  instructions:
    "Take the provided user story and decompose it into smaller, independently deliverable child stories. Each child story should retain the spirit of the original but be scoped to a single, shippable unit of work. Maintain the As a / I want / So that format for each child. Return a slicing summary describing the decomposition approach.",
  required_sections: [
    "title",
    "user_story",
    "as_a",
    "i_want",
    "so_that",
    "description",
    "acceptance_criteria",
    "edge_cases",
    "dependencies",
    "priority",
  ],
  quality_bar: [
    "Each child story must be independently deliverable",
    "Child stories must collectively cover the scope of the original",
    "Each child story must include title, as_a, i_want, so_that, and acceptance_criteria",
    "Acceptance criteria for each child must be specific and testable",
    "Avoid over-slicing — prefer meaningful units over micro-tasks",
  ],
  integration_notes: [
    "Each child story must conform to the standard project story shape used by Story Generator and Story Refiner",
    "Sliced child stories are persisted as new project story records linked via source_story_id",
    "The original story is marked as sliced, not deleted",
  ],
};

const DEFAULT_FEATURE_REFINEMENT_SKILL = {
  name: "Default Feature Refinement Skill",
  slug: "default-feature-refinement-skill",
  skill_type: "feature_refinement",
  description: "Default ProductOS skill for evaluating and refining existing feature specs.",
  is_active: true,
  instructions:
    "Evaluate each feature first, then refine only the parts that need improvement. Preserve the original intent while improving clarity, scope, requirements, dependencies, and success metrics.",
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
    "Preserve the original problem and business intent",
    "Make requirements actionable for downstream story generation",
    "Clarify dependencies and non-functional requirements where needed",
    "Strengthen success metrics so the feature is measurable",
    "Do not turn the output into a PRD",
  ],
  integration_notes: [
    "Refined features should remain compatible with Jira Epic export",
    "Refined output should improve Story Generator input quality",
    "This agent should improve the same feature, not create net-new feature records",
  ],
};

const DEFAULT_FEATURE_PRIORITIZATION_SKILL = {
  name: "Default Feature Prioritization Skill",
  slug: "default-feature-prioritization-skill",
  skill_type: "feature_prioritization",
  description: "Default ProductOS skill for ranking project features using an impact-versus-effort lens with PM-style tradeoff reasoning.",
  is_active: true,
  instructions:
    "Prioritize the provided features using Impact vs Effort as the default framework. Balance user value, business value, urgency, and strategic alignment against delivery effort and confidence. Recommend a rank order that a PM could defend in planning review.",
  required_sections: [
    "framework",
    "impact_score",
    "effort_score",
    "strategic_alignment_score",
    "urgency_score",
    "confidence_score",
    "overall_priority_score",
    "recommended_rank",
    "priority_bucket",
    "rationale",
    "tradeoffs",
    "recommendation",
  ],
  quality_bar: [
    "Use a consistent framework across all selected features",
    "Explain why items move up or down rather than only assigning scores",
    "Call out when a feature needs more refinement before confident prioritization",
    "Avoid recommending everything as high priority",
    "Tie recommendations back to user and business value",
  ],
  integration_notes: [
    "Prioritization should persist onto the same project feature records",
    "Results should help PMs decide what to refine, generate stories for, or export next",
    "This agent recommends priority order; it does not reorder Jira automatically",
  ],
};

const DEFAULT_COMPETITOR_ANALYSIS_SKILL = {
  name: "Default Competitor Analysis Skill",
  slug: "default-competitor-analysis-skill",
  skill_type: "competitor_analysis",
  description: "Default ProductOS skill for comparing a product against named competitors and identifying threats, gaps, and differentiation opportunities.",
  is_active: true,
  instructions:
    "Analyze the provided competitors against the user's product context. Use only the provided product context and general market reasoning. Do not claim live web research, citations, or current facts that were not supplied. Focus on practical PM outputs: competitive strengths, weaknesses, feature gaps, positioning, threats, and recommended responses.",
  required_sections: [
    "category",
    "confidence_score",
    "threat_level",
    "strengths",
    "weaknesses",
    "feature_gaps",
    "positioning_summary",
    "recommended_response",
  ],
  quality_bar: [
    "Return a result for every named competitor",
    "Separate observed competitor strengths from inferred risks or gaps",
    "Do not invent live market evidence or fake current research",
    "Make recommendations useful for PM strategy and roadmap decisions",
    "Differentiate direct threats from adjacent or weaker competitors",
  ],
  integration_notes: [
    "This first version is analysis-only and does not persist competitor entities",
    "Outputs should help PMs decide where to differentiate, prioritize, or refine strategy",
    "UI should present this as provided-context competitor analysis, not live monitored intelligence",
  ],
};

const SKILL_TYPE_CONFIG = {
  feature_spec: {
    label: "Feature Spec",
    icon: "auto_awesome",
    defaultSkill: DEFAULT_FEATURE_SPEC_SKILL,
    badgeCls: "bg-violet-50 text-violet-600 border-violet-100",
    ringCls: "ring-violet-500/40",
    stripeCls: "bg-violet-500",
    iconBgActiveCls: "bg-violet-500",
    formBgCls: "from-violet-50/60",
    cardActiveCls: "border-violet-200 bg-violet-50/60",
    sectionIconCls: "text-violet-500",
    saveBtnCls: "from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 shadow-violet-500/20",
    inputFocusCls: "focus:border-violet-500 focus:ring-violet-500/10",
  },
  story_spec: {
    label: "Story Spec",
    icon: "menu_book",
    defaultSkill: DEFAULT_STORY_SPEC_SKILL,
    badgeCls: "bg-emerald-50 text-emerald-600 border-emerald-100",
    ringCls: "ring-emerald-500/40",
    stripeCls: "bg-emerald-500",
    iconBgActiveCls: "bg-emerald-500",
    formBgCls: "from-emerald-50/60",
    cardActiveCls: "border-emerald-200 bg-emerald-50/60",
    sectionIconCls: "text-emerald-500",
    saveBtnCls: "from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-emerald-500/20",
    inputFocusCls: "focus:border-emerald-500 focus:ring-emerald-500/10",
  },
  story_refinement: {
    label: "Story Refinement",
    icon: "auto_fix_high",
    defaultSkill: DEFAULT_STORY_REFINEMENT_SKILL,
    badgeCls: "bg-blue-50 text-blue-600 border-blue-100",
    ringCls: "ring-blue-500/40",
    stripeCls: "bg-blue-500",
    iconBgActiveCls: "bg-blue-500",
    formBgCls: "from-blue-50/60",
    cardActiveCls: "border-blue-200 bg-blue-50/60",
    sectionIconCls: "text-blue-500",
    saveBtnCls: "from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-blue-500/20",
    inputFocusCls: "focus:border-blue-500 focus:ring-blue-500/10",
  },
  story_slicing: {
    label: "Story Slicing",
    icon: "call_split",
    defaultSkill: DEFAULT_STORY_SLICING_SKILL,
    badgeCls: "bg-amber-50 text-amber-600 border-amber-100",
    ringCls: "ring-amber-500/40",
    stripeCls: "bg-amber-500",
    iconBgActiveCls: "bg-amber-500",
    formBgCls: "from-amber-50/60",
    cardActiveCls: "border-amber-200 bg-amber-50/60",
    sectionIconCls: "text-amber-500",
    saveBtnCls: "from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 shadow-amber-500/20",
    inputFocusCls: "focus:border-amber-500 focus:ring-amber-500/10",
  },
  feature_refinement: {
    label: "Feature Refinement",
    icon: "auto_fix_high",
    defaultSkill: DEFAULT_FEATURE_REFINEMENT_SKILL,
    badgeCls: "bg-indigo-50 text-indigo-600 border-indigo-100",
    ringCls: "ring-indigo-500/40",
    stripeCls: "bg-indigo-500",
    iconBgActiveCls: "bg-indigo-500",
    formBgCls: "from-indigo-50/60",
    cardActiveCls: "border-indigo-200 bg-indigo-50/60",
    sectionIconCls: "text-indigo-500",
    saveBtnCls: "from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-indigo-500/20",
    inputFocusCls: "focus:border-indigo-500 focus:ring-indigo-500/10",
  },
  feature_prioritization: {
    label: "Feature Prioritization",
    icon: "sort",
    defaultSkill: DEFAULT_FEATURE_PRIORITIZATION_SKILL,
    badgeCls: "bg-orange-50 text-orange-600 border-orange-100",
    ringCls: "ring-orange-500/40",
    stripeCls: "bg-orange-500",
    iconBgActiveCls: "bg-orange-500",
    formBgCls: "from-orange-50/60",
    cardActiveCls: "border-orange-200 bg-orange-50/60",
    sectionIconCls: "text-orange-500",
    saveBtnCls: "from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 shadow-orange-500/20",
    inputFocusCls: "focus:border-orange-500 focus:ring-orange-500/10",
  },
  competitor_analysis: {
    label: "Competitor Analysis",
    icon: "query_stats",
    defaultSkill: DEFAULT_COMPETITOR_ANALYSIS_SKILL,
    badgeCls: "bg-teal-50 text-teal-600 border-teal-100",
    ringCls: "ring-teal-500/40",
    stripeCls: "bg-teal-500",
    iconBgActiveCls: "bg-teal-500",
    formBgCls: "from-teal-50/60",
    cardActiveCls: "border-teal-200 bg-teal-50/60",
    sectionIconCls: "text-teal-500",
    saveBtnCls: "from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 shadow-teal-500/20",
    inputFocusCls: "focus:border-teal-500 focus:ring-teal-500/10",
  },
};

function TagEditor({ label, hint, icon, values, onChange }) {
  const [tagDraft, setTagDraft] = useState("");

  function addValue() {
    const value = tagDraft.trim();
    if (!value) return;
    onChange([...(values ?? []), value]);
    setTagDraft("");
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon && (
          <span className="material-symbols-outlined text-[14px] text-on-surface-variant/60">{icon}</span>
        )}
        <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
        </label>
      </div>
      {(values ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 text-[11px] font-semibold rounded-full border border-violet-200"
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
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
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
          className="px-3 py-2 bg-surface border border-outline rounded-lg text-sm font-semibold text-on-surface hover:border-violet-400 hover:text-violet-600 transition"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function FormSection({ icon, title, iconCls, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-outline/60">
        <span className={`material-symbols-outlined text-[15px] ${iconCls ?? "text-violet-500"}`}>{icon}</span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{title}</p>
      </div>
      {children}
    </div>
  );
}

export default function Skills() {
  const [skills, setSkills]         = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedType, setSelectedType] = useState("feature_spec");
  const [draft, setDraft]           = useState(DEFAULT_FEATURE_SPEC_SKILL);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [message, setMessage]       = useState(null);
  const msgTimer                    = useRef(null);

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedId) ?? null,
    [skills, selectedId]
  );

  // Derive theme config from active draft type
  const cfg = SKILL_TYPE_CONFIG[draft.skill_type ?? "feature_spec"];

  useEffect(() => {
    loadSkills();
  }, []);

  useEffect(() => {
    if (!selectedSkill) return;
    setSelectedType(selectedSkill.skill_type ?? "feature_spec");
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
      const [featureRes, storyRes, storyRefinementRes, storySlicingRes, featureRefinementRes, featurePrioritizationRes, competitorAnalysisRes] = await Promise.allSettled([
        getSkills("feature_spec", null),
        getSkills("story_spec", null),
        getSkills("story_refinement", null),
        getSkills("story_slicing", null),
        getSkills("feature_refinement", null),
        getSkills("feature_prioritization", null),
        getSkills("competitor_analysis", null),
      ]);
      const featureRows = featureRes.status === "fulfilled"
        ? (Array.isArray(featureRes.value) ? featureRes.value : (featureRes.value?.skills ?? []))
        : [];
      const storyRows = storyRes.status === "fulfilled"
        ? (Array.isArray(storyRes.value) ? storyRes.value : (storyRes.value?.skills ?? []))
        : [];
      const storyRefinementRows = storyRefinementRes.status === "fulfilled"
        ? (Array.isArray(storyRefinementRes.value) ? storyRefinementRes.value : (storyRefinementRes.value?.skills ?? []))
        : [];
      const storySlicingRows = storySlicingRes.status === "fulfilled"
        ? (Array.isArray(storySlicingRes.value) ? storySlicingRes.value : (storySlicingRes.value?.skills ?? []))
        : [];
      const featureRefinementRows = featureRefinementRes.status === "fulfilled"
        ? (Array.isArray(featureRefinementRes.value) ? featureRefinementRes.value : (featureRefinementRes.value?.skills ?? []))
        : [];
      const featurePrioritizationRows = featurePrioritizationRes.status === "fulfilled"
        ? (Array.isArray(featurePrioritizationRes.value) ? featurePrioritizationRes.value : (featurePrioritizationRes.value?.skills ?? []))
        : [];
      const competitorAnalysisRows = competitorAnalysisRes.status === "fulfilled"
        ? (Array.isArray(competitorAnalysisRes.value) ? competitorAnalysisRes.value : (competitorAnalysisRes.value?.skills ?? []))
        : [];
      const all = [...featureRows, ...storyRows, ...storyRefinementRows, ...storySlicingRows, ...featureRefinementRows, ...featurePrioritizationRows, ...competitorAnalysisRows];
      setSkills(all);
      const preferred = all.find((s) => s.is_active) ?? all[0] ?? null;
      setSelectedId(preferred?.id ?? null);
      setSelectedType(preferred?.skill_type ?? "feature_spec");
      if (!preferred) setDraft(DEFAULT_FEATURE_SPEC_SKILL);
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
          slug: slugify(draft.name || `${(draft.skill_type ?? "feature-spec").replace("_", "-")}-skill`),
          description: draft.description.trim(),
          instructions: draft.instructions.trim(),
          is_active: true,
        });
        setSkills((current) => [...current, created]);
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
      {/* Page header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
          <span
            className="material-symbols-outlined text-white text-[22px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            psychology
          </span>
        </div>
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface mb-1">Skills</h2>
          <p className="text-sm text-on-surface-variant max-w-3xl">
            Skills define how ProductOS agents behave. Each agent uses its corresponding active skill — Feature Generator, Feature Refiner, Feature Prioritizer, Story Generator, Story Refiner, Story Slicer, and Competitor Analysis. The Story Refinement skill is also used during Backlog Refinement analysis. Configure instructions, required sections, and quality bar here.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-surface border border-outline rounded-2xl p-6 animate-pulse">
          <div className="h-4 w-40 bg-surface-container rounded mb-3" />
          <div className="h-3 w-96 bg-surface-container rounded mb-6" />
          <div className="h-64 bg-surface-container rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">

          {/* ── Skill list ── */}
          <div className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-card">
            <div className="px-4 pt-4 pb-3 border-b border-outline/60">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Available Skills
              </p>
            </div>

            <div className="py-2">
              {(["feature_spec", "story_spec", "story_refinement", "story_slicing", "feature_refinement", "feature_prioritization", "competitor_analysis"]).map((type) => {
                const typeCfg = SKILL_TYPE_CONFIG[type];
                const typeSkills = skills.filter((s) => s.skill_type === type);
                const itemsToShow = typeSkills.length > 0
                  ? typeSkills
                  : [{ ...typeCfg.defaultSkill, _isDefault: true }];

                return (
                  <div key={type}>
                    {/* Section header */}
                    <div className="px-4 pt-3 pb-1.5 flex items-center gap-1.5">
                      <span
                        className={`material-symbols-outlined text-[12px] ${typeCfg.sectionIconCls}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {typeCfg.icon}
                      </span>
                      <p className={`text-[9px] font-bold uppercase tracking-widest ${typeCfg.sectionIconCls}`}>
                        {typeCfg.label}
                      </p>
                    </div>

                    <div className="px-3 pb-2 space-y-2">
                      {itemsToShow.map((skill, index) => {
                        const isSelected = skill.id
                          ? skill.id === selectedId
                          : selectedId === null && selectedType === type;
                        return (
                          <button
                            key={skill.id ?? `default-${type}-${index}`}
                            onClick={() => {
                              if (skill.id) {
                                setSelectedId(skill.id);
                              } else {
                                setSelectedId(null);
                                setSelectedType(type);
                                setDraft(typeCfg.defaultSkill);
                              }
                            }}
                            className={[
                              "w-full text-left rounded-xl overflow-hidden transition-all",
                              isSelected
                                ? `ring-2 ${typeCfg.ringCls} shadow-sm`
                                : "hover:-translate-y-px hover:shadow-sm",
                            ].join(" ")}
                          >
                            <div className="flex">
                              {/* accent stripe */}
                              <div className={[
                                "w-1 shrink-0 rounded-l-xl",
                                isSelected ? typeCfg.stripeCls : "bg-outline/40",
                              ].join(" ")} />

                              <div className={[
                                "flex-1 p-3 border border-l-0 rounded-r-xl transition-colors",
                                isSelected
                                  ? typeCfg.cardActiveCls
                                  : "border-outline bg-surface hover:bg-surface-container/30",
                              ].join(" ")}>
                                <div className="flex items-start gap-2.5">
                                  <div className={[
                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                    isSelected ? typeCfg.iconBgActiveCls : "bg-surface-container",
                                  ].join(" ")}>
                                    <span
                                      className={[
                                        "material-symbols-outlined text-[16px]",
                                        isSelected ? "text-white" : "text-on-surface-variant",
                                      ].join(" ")}
                                      style={{ fontVariationSettings: "'FILL' 1" }}
                                    >
                                      {typeCfg.icon}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-headline font-bold text-on-surface leading-snug">{skill.name}</p>
                                    <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2 leading-relaxed">{skill.description}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2.5 pl-[42px]">
                                  {(skill.is_active ?? true) && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                                      Active
                                    </span>
                                  )}
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeCfg.badgeCls}`}>
                                    {typeCfg.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Skill form ── */}
          <form onSubmit={handleSave} className="bg-surface border border-outline rounded-2xl overflow-hidden shadow-card">

            {/* Form header */}
            <div className={`px-6 py-4 border-b border-outline/60 bg-gradient-to-r ${cfg.formBgCls} to-transparent flex items-center justify-between gap-4`}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
                  Skill Configuration
                </p>
                <p className="text-sm text-on-surface-variant">
                  {draft.skill_type === "story_spec"
                    ? "Changes here affect the Story Generator agent."
                    : draft.skill_type === "story_refinement"
                      ? "Changes here affect the Story Refiner agent."
                      : draft.skill_type === "story_slicing"
                        ? "Changes here affect the Story Slicer agent."
                        : draft.skill_type === "feature_refinement"
                          ? "Changes here affect the Feature Refiner agent."
                          : draft.skill_type === "feature_prioritization"
                            ? "Changes here affect the Feature Prioritizer agent."
                            : draft.skill_type === "competitor_analysis"
                              ? "Changes here affect the Competitor Analysis agent."
                              : "Changes here affect the Feature Generator agent and workflow feature artifact generation."}
                </p>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 ${cfg.badgeCls}`}>
                {cfg.label}
              </span>
            </div>

            <div className="p-6 space-y-6">

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

              {/* Identity section */}
              <FormSection icon="badge" title="Identity" iconCls={cfg.sectionIconCls}>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                    Skill Name
                  </label>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                    className={`w-full px-3 py-2 text-sm font-semibold text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:ring-2 ${cfg.inputFocusCls} transition`}
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
                    className={`w-full px-3 py-2 text-sm text-on-surface bg-surface-container rounded-lg border border-outline focus:outline-none focus:ring-2 ${cfg.inputFocusCls} resize-none transition`}
                  />
                </div>
              </FormSection>

              {/* Instructions section */}
              <FormSection icon="terminal" title="Instructions" iconCls={cfg.sectionIconCls}>
                <div className="relative">
                  <textarea
                    value={draft.instructions}
                    onChange={(e) => setDraft((current) => ({ ...current, instructions: e.target.value }))}
                    rows={9}
                    className={`w-full px-3.5 py-3 text-sm font-mono text-on-surface bg-slate-950/[0.03] rounded-xl border border-outline focus:outline-none focus:ring-2 ${cfg.inputFocusCls} resize-none transition leading-relaxed`}
                    style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace" }}
                    placeholder="Write your agent instructions here…"
                  />
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 bg-surface border border-outline rounded-md pointer-events-none">
                    <span className="material-symbols-outlined text-[11px] text-on-surface-variant/60">smart_toy</span>
                    <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest">Prompt</span>
                  </div>
                </div>
              </FormSection>

              {/* Structure section */}
              <FormSection icon="list_alt" title="Output Structure" iconCls={cfg.sectionIconCls}>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <TagEditor
                    label="Required Sections"
                    hint="Add required body sections"
                    icon="format_list_bulleted"
                    values={draft.required_sections}
                    onChange={(value) => setDraft((current) => ({ ...current, required_sections: value }))}
                  />
                  <TagEditor
                    label="Quality Bar"
                    hint="Add quality expectations"
                    icon="verified"
                    values={draft.quality_bar}
                    onChange={(value) => setDraft((current) => ({ ...current, quality_bar: value }))}
                  />
                </div>
              </FormSection>

              {/* Integration section */}
              <FormSection icon="cable" title="Integration Notes" iconCls={cfg.sectionIconCls}>
                <TagEditor
                  label="Downstream Jira / Export Notes"
                  hint="Add downstream Jira/export notes"
                  icon="output"
                  values={draft.integration_notes}
                  onChange={(value) => setDraft((current) => ({ ...current, integration_notes: value }))}
                />
              </FormSection>

              {/* Save */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={saving || !draft.name.trim() || !draft.instructions.trim()}
                  className={`flex items-center gap-2 px-5 py-3 bg-gradient-to-r ${cfg.saveBtnCls} text-white text-sm font-bold rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {saving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      Save Skill
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
