alter table project_features
  add column if not exists prioritization jsonb not null default '{}'::jsonb;

insert into skills (
    name,
    slug,
    skill_type,
    description,
    is_active,
    instructions,
    required_sections,
    quality_bar,
    integration_notes
)
select
    'Default Feature Prioritization Skill',
    'default-feature-prioritization-skill',
    'feature_prioritization',
    'Default ProductOS skill for prioritizing project features using an impact-versus-effort lens.',
    true,
    'Prioritize the provided features using Impact vs Effort as the default framework. Balance user value, business value, urgency, and strategic alignment against delivery effort and confidence. Recommend a rank order that a PM could defend in planning review.',
    '["framework","impact_score","effort_score","strategic_alignment_score","urgency_score","confidence_score","overall_priority_score","recommended_rank","priority_bucket","rationale","tradeoffs","recommendation"]'::jsonb,
    '[
      "Use a consistent framework across all selected features",
      "Explain why items move up or down rather than only assigning scores",
      "Call out when a feature needs more refinement before confident prioritization",
      "Avoid recommending everything as high priority",
      "Tie recommendations back to user and business value"
    ]'::jsonb,
    '[
      "Prioritization should persist onto the same project feature records",
      "Results should help PMs decide what to refine, generate stories for, or export next",
      "This agent recommends priority order; it does not reorder Jira automatically"
    ]'::jsonb
where not exists (
    select 1
    from skills
    where skill_type = 'feature_prioritization'
      and slug = 'default-feature-prioritization-skill'
);
