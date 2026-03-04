-- Morning briefing & weekly report storage
create table if not exists briefings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type text not null check (type in ('morning', 'weekly')),
  content jsonb not null,
  brief_date date not null,
  generated_at timestamptz not null default now(),
  generated_by text not null default 'claude-sonnet-4-6',
  created_at timestamptz not null default now()
);

-- Unique constraint enables upsert on (org, type, date)
alter table briefings
  add constraint briefings_org_type_date_unique
  unique (organization_id, type, brief_date);

create index if not exists briefings_org_type_date_idx
  on briefings (organization_id, type, brief_date);

alter table briefings enable row level security;

-- Directors and admins can read their org's briefings
create policy "Staff can read org briefings"
  on briefings for select
  using (
    organization_id = (
      select organization_id from staff
      where supabase_user_id = auth.uid()
      and role in ('director', 'admin')
      and is_active = true
      limit 1
    )
  );

-- Only the edge function (service role) can insert/update
create policy "Service role can upsert briefings"
  on briefings for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
