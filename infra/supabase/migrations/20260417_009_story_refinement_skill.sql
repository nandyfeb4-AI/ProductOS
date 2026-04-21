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
  'Default Story Refinement Skill',
  'default-story-refinement-skill',
  'story_refinement',
  'Default ProductOS skill for evaluating and refining implementation-ready stories.',
  true,
  'Evaluate each story first, then refine only the parts that need improvement. Strengthen acceptance criteria, reduce ambiguity, preserve intent, and keep the result concrete and implementation-ready.',
  '["title","user_story","as_a","i_want","so_that","description","acceptance_criteria","edge_cases","dependencies","priority"]'::jsonb,
  '["Score each story before refining it","Keep the refined story grounded in the original intent","Make acceptance criteria concrete and testable","Clarify missing edge cases and dependencies when needed","Do not split one story into multiple stories"]'::jsonb,
  '["Refined stories should remain compatible with Jira Story or Task issue types","This agent should improve existing stories, not create net-new backlog items"]'::jsonb
where not exists (
  select 1
  from skills
  where slug = 'default-story-refinement-skill'
);
