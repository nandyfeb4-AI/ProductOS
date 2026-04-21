alter table if exists project_stories
    add column if not exists source_story_id uuid references project_stories(id) on delete set null;

create index if not exists idx_project_stories_source_story_id
    on project_stories (source_story_id);

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
    'Default Story Slicing Skill',
    'default-story-slicing-skill',
    'story_slicing',
    'Default ProductOS skill for splitting an oversized story into smaller implementation-ready stories.',
    true,
    'Split one oversized story into a small set of independently deliverable child stories. Preserve the original intent, avoid overlap, and keep each output concrete and implementation-ready.',
    '["title","user_story","as_a","i_want","so_that","description","acceptance_criteria","edge_cases","dependencies","priority"]'::jsonb,
    '[
      "Preserve the intent of the original story",
      "Create 2 to 4 independently deliverable child stories by default",
      "Avoid duplicate or overlapping child stories",
      "Keep acceptance criteria concrete and testable",
      "Do not invent unrelated backlog work"
    ]'::jsonb,
    '[
      "Sliced stories should persist as project stories linked back to the source story",
      "The original story should remain available for review after slicing",
      "Outputs should be clean inputs for Story Refiner and Jira export"
    ]'::jsonb
where not exists (
    select 1
    from skills
    where skill_type = 'story_slicing'
      and slug = 'default-story-slicing-skill'
);
