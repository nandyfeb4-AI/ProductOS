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
    'Default Feature Refinement Skill',
    'default-feature-refinement-skill',
    'feature_refinement',
    'Default ProductOS skill for evaluating and refining existing feature specs.',
    true,
    'Evaluate each feature first, then refine only the parts that need improvement. Preserve the original intent while improving clarity, scope, requirements, dependencies, and success metrics.',
    '["problem_statement","user_segment","proposed_solution","user_value","business_value","functional_requirements","non_functional_requirements","dependencies","success_metrics","priority"]'::jsonb,
    '[
      "Preserve the original problem and business intent",
      "Make requirements actionable for downstream story generation",
      "Clarify dependencies and non-functional requirements where needed",
      "Strengthen success metrics so the feature is measurable",
      "Do not turn the output into a PRD"
    ]'::jsonb,
    '[
      "Refined features should remain compatible with Jira Epic export",
      "Refined output should improve Story Generator input quality",
      "This agent should improve the same feature, not create net-new feature records"
    ]'::jsonb
where not exists (
    select 1
    from skills
    where skill_type = 'feature_refinement'
      and slug = 'default-feature-refinement-skill'
);
