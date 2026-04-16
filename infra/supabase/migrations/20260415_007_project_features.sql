create table if not exists project_features (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_type text not null default 'prompt',
  source_title text not null,
  source_summary text not null,
  source_details text,
  desired_outcome text,
  constraints jsonb not null default '[]'::jsonb,
  supporting_context jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  generator_type text not null default 'feature_generator',
  skill_id uuid references skills(id) on delete set null,
  skill_name text,
  title text not null,
  summary text not null default '',
  body jsonb not null default '{}'::jsonb,
  jira_issue_key text,
  jira_issue_url text,
  jira_issue_type text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_project_features_project_updated
  on project_features(project_id, updated_at desc);

create index if not exists idx_project_features_status_updated
  on project_features(status, updated_at desc);

drop trigger if exists project_features_set_updated_at on project_features;
create trigger project_features_set_updated_at
before update on project_features
for each row
execute function set_updated_at();
