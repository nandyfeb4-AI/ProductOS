create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_projects_status_updated
  on projects(status, updated_at desc);

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at
before update on projects
for each row
execute function set_updated_at();

alter table if exists workflow_runs
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists idx_workflow_runs_project_updated
  on workflow_runs(project_id, updated_at desc);
