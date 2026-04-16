create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  skill_type text not null,
  description text,
  is_active boolean not null default true,
  instructions text not null default '',
  required_sections jsonb not null default '[]'::jsonb,
  quality_bar jsonb not null default '[]'::jsonb,
  integration_notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_skills_type_active_updated
  on skills(skill_type, is_active, updated_at desc);

drop trigger if exists skills_set_updated_at on skills;
create trigger skills_set_updated_at
before update on skills
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
  'Default Feature Spec Skill',
  'default-feature-spec-skill',
  'feature_spec',
  'Default ProductOS skill for writing a PM-ready feature spec from discovery inputs.',
  true,
  'Write one PM-ready feature spec grounded in the provided source material. Keep it concrete, delivery-oriented, and concise. Emphasize the user problem, the proposed solution, and the requirements needed to make it implementation-ready.',
  '["problem_statement","user_segment","proposed_solution","user_value","business_value","functional_requirements","non_functional_requirements","dependencies","success_metrics","priority"]'::jsonb,
  '["Ground the output in the provided input","Avoid vague platform-language","Make requirements actionable for downstream story generation","Capture meaningful success metrics","Do not turn the output into a PRD"]'::jsonb,
  '["This skill should map cleanly to the existing Jira epic/feature export structure","Functional requirements should be ready for story generation input"]'::jsonb
where not exists (
  select 1
  from skills
  where slug = 'default-feature-spec-skill'
);
