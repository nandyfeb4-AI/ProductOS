alter table workflow_runs
  add column if not exists workflow_definition_key text,
  add column if not exists workflow_definition_label text;

update workflow_runs
set
  workflow_definition_key = coalesce(workflow_definition_key, 'discovery_to_delivery'),
  workflow_definition_label = coalesce(workflow_definition_label, 'Discovery to Delivery')
where workflow_type = 'workshop';

create index if not exists idx_workflow_runs_definition_updated
  on workflow_runs(workflow_definition_key, updated_at desc);
