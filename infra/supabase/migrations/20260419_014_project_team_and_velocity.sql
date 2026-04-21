alter table projects
add column if not exists average_velocity_per_sprint integer not null default 24;

create table if not exists project_team_members (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    full_name text not null,
    role_key text not null,
    role_label text not null,
    discipline text not null,
    seniority text not null default 'mid',
    allocation_pct integer not null default 100 check (allocation_pct >= 0 and allocation_pct <= 100),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_project_team_members_project_id
on project_team_members(project_id);

insert into project_team_members (
    project_id,
    full_name,
    role_key,
    role_label,
    discipline,
    seniority,
    allocation_pct
)
select
    p.id,
    seed.full_name,
    seed.role_key,
    seed.role_label,
    seed.discipline,
    seed.seniority,
    seed.allocation_pct
from projects p
cross join (
    values
        ('Ava Patel', 'pm', 'Product Manager', 'product', 'senior', 100),
        ('Noah Kim', 'design', 'Product Designer', 'design', 'senior', 100),
        ('Mia Chen', 'frontend', 'Frontend Engineer', 'engineering', 'senior', 100),
        ('Ethan Brooks', 'backend', 'Backend Engineer', 'engineering', 'senior', 100),
        ('Priya Nair', 'fullstack', 'Full Stack Engineer', 'engineering', 'mid', 100),
        ('Liam Rivera', 'qa', 'QA Engineer', 'quality', 'mid', 100),
        ('Sofia Martinez', 'devops', 'DevOps Engineer', 'platform', 'senior', 100),
        ('Lucas Johnson', 'data', 'Data Analyst', 'data', 'mid', 75),
        ('Grace Walker', 'techlead', 'Tech Lead', 'engineering', 'staff', 50)
) as seed(full_name, role_key, role_label, discipline, seniority, allocation_pct)
where not exists (
    select 1
    from project_team_members ptm
    where ptm.project_id = p.id
);
