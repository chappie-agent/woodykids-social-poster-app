-- supabase/migrations/001_initial_schema.sql

create table posts (
  id            uuid primary key default gen_random_uuid(),
  state         text not null check (state in ('empty', 'draft', 'conflict', 'locked')),
  position      integer not null unique,
  source        jsonb,
  crop_data     jsonb not null default '{"x":0,"y":0,"scale":1}',
  caption       jsonb,
  scheduled_at  timestamptz,
  is_person     boolean not null default false,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

alter table posts enable row level security;

create policy "team_all" on posts
  for all to authenticated
  using (true)
  with check (true);

create index on posts (position);

create table settings (
  id              integer primary key default 1,
  tone_of_voice   text not null default '',
  updated_at      timestamptz not null default now()
);

alter table settings enable row level security;

create policy "team_all" on settings
  for all to authenticated
  using (true)
  with check (true);
