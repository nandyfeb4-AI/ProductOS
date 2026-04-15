create table if not exists generation_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null default 'queued',
  progress_stage text,
  progress_message text,
  input_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create index if not exists idx_generation_jobs_type_status
  on generation_jobs(job_type, status);

drop trigger if exists generation_jobs_set_updated_at on generation_jobs;
create trigger generation_jobs_set_updated_at
before update on generation_jobs
for each row
execute function set_updated_at();
