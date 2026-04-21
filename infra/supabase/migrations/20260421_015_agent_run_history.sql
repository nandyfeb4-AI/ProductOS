alter table if exists generation_jobs
  add column if not exists project_id uuid references projects(id) on delete set null,
  add column if not exists agent_key text,
  add column if not exists agent_label text;

update generation_jobs
set project_id = (input_payload->>'project_id')::uuid
where project_id is null
  and input_payload ? 'project_id'
  and (input_payload->>'project_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

update generation_jobs
set
  agent_key = case job_type
    when 'feature_generation' then 'feature_generator'
    when 'feature_refinement' then 'feature_refiner'
    when 'feature_prioritization' then 'feature_prioritizer'
    when 'story_generation' then 'story_generator'
    when 'story_refinement' then 'story_refiner'
    when 'story_slicer' then 'story_slicer'
    when 'competitor_analysis' then 'competitor_analysis'
    else agent_key
  end,
  agent_label = case job_type
    when 'feature_generation' then 'Feature Generator'
    when 'feature_refinement' then 'Feature Refiner'
    when 'feature_prioritization' then 'Feature Prioritizer'
    when 'story_generation' then 'Story Generator'
    when 'story_refinement' then 'Story Refiner'
    when 'story_slicer' then 'Story Slicer'
    when 'competitor_analysis' then 'Competitor Analysis'
    else agent_label
  end
where agent_key is null
  and job_type in (
    'feature_generation',
    'feature_refinement',
    'feature_prioritization',
    'story_generation',
    'story_refinement',
    'story_slicer',
    'competitor_analysis'
  );

create index if not exists idx_generation_jobs_project_updated
  on generation_jobs(project_id, updated_at desc);

create index if not exists idx_generation_jobs_agent_project_updated
  on generation_jobs(agent_key, project_id, updated_at desc);
