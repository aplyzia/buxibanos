-- BuxibanOS n8n Setup
-- Run this in Supabase SQL Editor before activating any workflows

-- Table for n8n to log workflow failures without blocking main flows
create table if not exists workflow_errors (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  workflow_name   text not null,
  error_message   text,
  payload         jsonb,
  created_at      timestamptz default now()
);

-- Index for org-scoped error queries
create index if not exists workflow_errors_org_id_idx
  on workflow_errors (organization_id, created_at desc);

-- RLS: staff (director/admin) can read their org's errors; n8n uses service key (bypasses RLS)
alter table workflow_errors enable row level security;

create policy "staff can read own org workflow errors"
  on workflow_errors for select
  using (organization_id = get_user_organization_id());

-- ─────────────────────────────────────────────────────────────────
-- RPC: get_message_context
-- Called by WF1 to fetch sender + student + teacher in one round trip
-- ─────────────────────────────────────────────────────────────────
create or replace function get_message_context(
  p_sender_user_id  uuid,
  p_primary_student text,
  p_organization_id uuid
)
returns json
language plpgsql security definer
as $$
declare
  v_parent    record;
  v_student   record;
  v_teacher   record;
begin
  -- Get parent record
  select id, full_name
  into v_parent
  from parents
  where supabase_user_id = p_sender_user_id
    and organization_id  = p_organization_id
  limit 1;

  -- Get student record (match by display_name or full_name)
  select id, full_name, assigned_teacher_id
  into v_student
  from students
  where organization_id = p_organization_id
    and (full_name = p_primary_student or display_name = p_primary_student)
  limit 1;

  -- Get assigned teacher
  if v_student.assigned_teacher_id is not null then
    select id, full_name, push_token
    into v_teacher
    from staff
    where id = v_student.assigned_teacher_id
    limit 1;
  end if;

  return json_build_object(
    'parent_id',                  v_parent.id,
    'parent_name',                v_parent.full_name,
    'student_id',                 v_student.id,
    'student_name',               v_student.full_name,
    'assigned_teacher_id',        v_teacher.id,
    'teacher_name',               v_teacher.full_name,
    'teacher_push_token',         v_teacher.push_token
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- RPC: get_director_push_tokens
-- Called by WF1 to notify directors on high-priority messages
-- ─────────────────────────────────────────────────────────────────
create or replace function get_director_push_tokens(
  p_organization_id uuid
)
returns json
language plpgsql security definer
as $$
begin
  return (
    select json_agg(json_build_object('push_token', push_token))
    from staff
    where organization_id = p_organization_id
      and role in ('director', 'admin')
      and is_active = true
      and push_token is not null
      and notification_pref in ('all', 'urgent_only', 'urgent_and_digest')
  );
end;
$$;
