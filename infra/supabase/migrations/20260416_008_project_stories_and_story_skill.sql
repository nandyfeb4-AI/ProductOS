create table if not exists project_stories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_type text not null default 'feature',
  source_feature_id uuid references project_features(id) on delete set null,
  status text not null default 'draft',
  generator_type text not null default 'story_generator',
  skill_id uuid references skills(id) on delete set null,
  skill_name text,
  title text not null,
  user_story text not null default '',
  as_a text not null default '',
  i_want text not null default '',
  so_that text not null default '',
  description text not null default '',
  acceptance_criteria jsonb not null default '[]'::jsonb,
  edge_cases jsonb not null default '[]'::jsonb,
  dependencies jsonb not null default '[]'::jsonb,
  priority text not null default 'medium',
  jira_issue_key text,
  jira_issue_url text,
  jira_issue_type text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_project_stories_project_updated
  on project_stories(project_id, updated_at desc);

create index if not exists idx_project_stories_source_feature
  on project_stories(source_feature_id, updated_at desc);

create index if not exists idx_project_stories_status_updated
  on project_stories(status, updated_at desc);

drop trigger if exists project_stories_set_updated_at on project_stories;
create trigger project_stories_set_updated_at
before update on project_stories
for each row
execute function set_updated_at();

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
  'Default Story Spec Skill',
  'default-story-spec-skill',
  'story_spec',
  'Default ProductOS skill for writing implementation-ready stories from a feature.',
  true,
  'Write implementation-ready delivery stories from the provided feature. Keep stories concrete, independently actionable, and small enough to estimate. Use the classic user story shape and make acceptance criteria testable.',
  '["title","user_story","as_a","i_want","so_that","description","acceptance_criteria","edge_cases","dependencies","priority"]'::jsonb,
  '["Ground every story in the source feature","Keep frontend, backend, analytics, and integration work separate when naturally separable","Use concrete, testable acceptance criteria","Avoid vague planning language","Prefer 3 to 5 meaningful stories for a normal feature"]'::jsonb,
  '["Stories should map cleanly to Jira Story or Task issue types","Story output should be ready for later refinement or slicing agents"]'::jsonb
where not exists (
  select 1
  from skills
  where slug = 'default-story-spec-skill'
);
