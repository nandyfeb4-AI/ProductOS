create extension if not exists pgcrypto;

create table if not exists integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  state text not null unique,
  external_user_id text,
  username text,
  full_name text,
  access_token text,
  refresh_token text,
  scopes jsonb not null default '[]'::jsonb,
  token_expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_integration_connections_provider
  on integration_connections(provider);

create table if not exists connector_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  connection_state text not null references integration_connections(state) on delete cascade,
  external_resource_id text not null,
  external_resource_name text,
  imported_widget_count integer not null default 0,
  extracted_text jsonb not null default '[]'::jsonb,
  insights jsonb not null default '{}'::jsonb,
  status text not null default 'completed',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_connector_sync_runs_provider_state
  on connector_sync_runs(provider, connection_state);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists integration_connections_set_updated_at on integration_connections;
create trigger integration_connections_set_updated_at
before update on integration_connections
for each row
execute function set_updated_at();
