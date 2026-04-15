create table if not exists workshops (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  status text not null default 'active',
  source_provider text,
  source_resource_id text,
  source_resource_name text,
  source_url text,
  transcript text,
  notes text,
  source_payload jsonb not null default '{}'::jsonb,
  insights_payload jsonb not null default '{}'::jsonb,
  journey_payload jsonb not null default '{}'::jsonb,
  import_meta jsonb not null default '{}'::jsonb,
  current_workflow_id uuid references workflow_runs(id) on delete set null,
  latest_workflow_step text,
  latest_workflow_status text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_workshops_project_updated
  on workshops(project_id, updated_at desc);

create index if not exists idx_workshops_status_updated
  on workshops(status, updated_at desc);

alter table if exists workflow_runs
  add column if not exists workshop_id uuid references workshops(id) on delete set null;

create index if not exists idx_workflow_runs_workshop_updated
  on workflow_runs(workshop_id, updated_at desc);

drop trigger if exists workshops_set_updated_at on workshops;
create trigger workshops_set_updated_at
before update on workshops
for each row
execute function set_updated_at();
