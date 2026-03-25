-- Migration: Enrich n8n RPC functions with AI context
-- Makes school policies, student details, and parent notes available to Claude

-- ─────────────────────────────────────────────────────────────────
-- WF1: get_message_context — now returns enriched student + parent + school data
-- ─────────────────────────────────────────────────────────────────
create or replace function get_message_context(
  p_sender_user_id  uuid,
  p_primary_student text,
  p_organization_id uuid
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_parent_id              uuid;
  v_parent_name            text;
  v_parent_comm_notes      text;
  v_student_id             uuid;
  v_student_name           text;
  v_student_grade          text;
  v_student_special_needs  text;
  v_teacher_id             uuid;
  v_teacher_name           text;
  v_teacher_push_token     text;
  v_assigned_teacher_id    uuid;
  v_school_policies        jsonb;
begin
  -- Get parent record
  if p_sender_user_id is not null then
    select id, full_name, communication_notes
    into v_parent_id, v_parent_name, v_parent_comm_notes
    from public.parents
    where supabase_user_id = p_sender_user_id
      and organization_id  = p_organization_id
    limit 1;
  end if;

  -- Get student record (match by display_name, full_name, or nicknames)
  select id, full_name, grade_level, special_needs, assigned_teacher_id
  into v_student_id, v_student_name, v_student_grade, v_student_special_needs, v_assigned_teacher_id
  from public.students
  where organization_id = p_organization_id
    and (full_name = p_primary_student
         or display_name = p_primary_student
         or p_primary_student = any(nicknames))
  limit 1;

  -- Get assigned teacher
  if v_assigned_teacher_id is not null then
    select id, full_name, push_token
    into v_teacher_id, v_teacher_name, v_teacher_push_token
    from public.staff
    where id = v_assigned_teacher_id
    limit 1;
  end if;

  -- Get school policies
  select school_policies
  into v_school_policies
  from public.organizations
  where id = p_organization_id;

  return json_build_object(
    'parent_id',             v_parent_id,
    'parent_name',           v_parent_name,
    'parent_comm_notes',     v_parent_comm_notes,
    'student_id',            v_student_id,
    'student_name',          v_student_name,
    'student_grade',         v_student_grade,
    'student_special_needs', v_student_special_needs,
    'assigned_teacher_id',   v_teacher_id,
    'teacher_name',          v_teacher_name,
    'teacher_push_token',    v_teacher_push_token,
    'school_policies',       v_school_policies
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- WF3: upsert_attendance_by_name — now also matches nicknames[]
-- ─────────────────────────────────────────────────────────────────
create or replace function upsert_attendance_by_name(
  p_organization_id uuid,
  p_class_id        uuid,
  p_date            date,
  p_records         jsonb
)
returns json language plpgsql security definer
set search_path = public
as $$
declare
  v_record     jsonb;
  v_student_id uuid;
  v_inserted   int := 0;
  v_skipped    int := 0;
  v_name       text;
begin
  for v_record in select * from jsonb_array_elements(p_records)
  loop
    v_name := v_record->>'student_name';

    select id into v_student_id
    from public.students
    where organization_id = p_organization_id
      and (full_name = v_name
           or display_name = v_name
           or v_name = any(nicknames))
    limit 1;

    if v_student_id is not null then
      insert into public.attendance (
        organization_id, student_id, class_id, date,
        status, source, recorded_by, parent_notified
      )
      values (
        p_organization_id, v_student_id, p_class_id, p_date,
        (v_record->>'status')::text, 'auto_message',
        (v_record->>'recorded_by')::uuid, false
      )
      on conflict (student_id, class_id, date)
      do update set
        status      = excluded.status,
        source      = excluded.source,
        recorded_by = excluded.recorded_by;
      v_inserted := v_inserted + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;
  return json_build_object('inserted', v_inserted, 'skipped', v_skipped);
end; $$;

-- ─────────────────────────────────────────────────────────────────
-- WF5: get_weekly_stats — now includes school_policies
-- ─────────────────────────────────────────────────────────────────
create or replace function get_weekly_stats(
  p_organization_id uuid,
  p_days            int default 7
)
returns json language plpgsql security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - (p_days || ' days')::interval;
  v_school_policies jsonb;
begin
  select school_policies into v_school_policies
  from public.organizations where id = p_organization_id;

  return json_build_object(
    'messages', (
      select json_build_object(
        'total',      count(*),
        'high',       count(*) filter (where priority = 'high'),
        'medium',     count(*) filter (where priority = 'medium'),
        'low',        count(*) filter (where priority = 'low'),
        'responded',  count(*) filter (where staff_responded = true),
        'unanswered', count(*) filter (where staff_responded = false),
        'by_type', (select json_agg(json_build_object('type', message_type, 'count', cnt))
                    from (select message_type, count(*) as cnt from public.messages
                          where organization_id = p_organization_id and created_at >= v_since
                          group by message_type) t)
      )
      from public.messages
      where organization_id = p_organization_id and created_at >= v_since
    ),
    'attendance', (
      select json_build_object(
        'total',   count(*),
        'present', count(*) filter (where status = 'present'),
        'absent',  count(*) filter (where status = 'absent'),
        'tardy',   count(*) filter (where status = 'tardy'),
        'excused', count(*) filter (where status = 'excused')
      ) from public.attendance
      where organization_id = p_organization_id and date >= v_since::date
    ),
    'fees', (
      select json_build_object(
        'overdue_count',  count(*) filter (where status = 'overdue'),
        'overdue_amount', coalesce(sum(amount_ntd) filter (where status = 'overdue'), 0),
        'paid_this_week', count(*) filter (where status = 'paid' and paid_date >= v_since::date),
        'paid_amount',    coalesce(sum(amount_ntd) filter (where status = 'paid' and paid_date >= v_since::date), 0)
      ) from public.fee_records
      where organization_id = p_organization_id
    ),
    'tasks', (
      select json_build_object(
        'created',   count(*) filter (where created_at >= v_since),
        'completed', count(*) filter (where status = 'completed' and created_at >= v_since),
        'pending',   count(*) filter (where status = 'pending')
      ) from public.tasks
      where organization_id = p_organization_id
    ),
    'school_policies', v_school_policies
  );
end; $$;

-- ─────────────────────────────────────────────────────────────────
-- NEW: get_class_students — returns student roster with nicknames for WF3
-- Called by n8n before sending transcript to Claude for attendance extraction
-- ─────────────────────────────────────────────────────────────────
create or replace function get_class_students(
  p_organization_id uuid,
  p_class_id        uuid
)
returns json language plpgsql security definer
set search_path = public
as $$
begin
  return (
    select json_agg(json_build_object(
      'full_name',    full_name,
      'display_name', display_name,
      'nicknames',    nicknames
    ))
    from public.students
    where organization_id = p_organization_id
      and p_class_id = any(class_ids)
      and enrollment_status = 'active'
  );
end; $$;
