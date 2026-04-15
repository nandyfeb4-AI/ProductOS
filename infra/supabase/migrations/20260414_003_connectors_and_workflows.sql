alter table if exists integration_connections
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_type text not null default 'workshop',
  title text,
  source_provider text,
  source_resource_id text,
  source_resource_name text,
  current_step text not null default 'workshop',
  status text not null default 'active',
  state_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_workflow_runs_type_updated
  on workflow_runs(workflow_type, updated_at desc);

create index if not exists idx_workflow_runs_source
  on workflow_runs(source_provider, source_resource_id);

drop trigger if exists workflow_runs_set_updated_at on workflow_runs;
create trigger workflow_runs_set_updated_at
before update on workflow_runs
for each row
execute function set_updated_at();
