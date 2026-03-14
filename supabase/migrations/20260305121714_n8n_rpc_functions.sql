-- BuxibanOS n8n RPC Functions (WF2, WF3, WF4, WF5, WF6)
-- All functions are SECURITY DEFINER — called by n8n with service role key

-- ─────────────────────────────────────────────────────────────────
-- WF2: get_digest_push_tokens
-- ─────────────────────────────────────────────────────────────────
create or replace function get_digest_push_tokens(p_organization_id uuid)
returns json language plpgsql security definer as $$
begin
  return (
    select json_agg(json_build_object('push_token', push_token))
    from staff
    where organization_id = p_organization_id
      and is_active = true
      and push_token is not null
      and notification_pref in ('all', 'urgent_and_digest', 'digest_only')
  );
end; $$;

-- ─────────────────────────────────────────────────────────────────
-- WF3: upsert_attendance_by_name
-- ─────────────────────────────────────────────────────────────────
create or replace function upsert_attendance_by_name(
  p_organization_id uuid,
  p_class_id        uuid,
  p_date            date,
  p_records         jsonb
)
returns json language plpgsql security definer as $$
declare
  v_record  jsonb;
  v_student record;
  v_inserted int := 0;
  v_skipped  int := 0;
begin
  for v_record in select * from jsonb_array_elements(p_records)
  loop
    select id into v_student
    from students
    where organization_id = p_organization_id
      and (full_name = (v_record->>'student_name') or display_name = (v_record->>'student_name'))
    limit 1;

    if v_student.id is not null then
      insert into attendance (
        organization_id, student_id, class_id, date,
        status, source, recorded_by, parent_notified
      )
      values (
        p_organization_id, v_student.id, p_class_id, p_date,
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
-- WF4: get_broadcast_push_tokens
-- ─────────────────────────────────────────────────────────────────
create or replace function get_broadcast_push_tokens(
  p_organization_id   uuid,
  p_target_type       text,
  p_target_parent_ids uuid[]
)
returns json language plpgsql security definer as $$
begin
  if p_target_type = 'all' then
    return (select json_agg(json_build_object('push_token', push_token))
            from parents where organization_id = p_organization_id and push_token is not null);
  else
    return (select json_agg(json_build_object('push_token', push_token))
            from parents where organization_id = p_organization_id
              and id = any(p_target_parent_ids) and push_token is not null);
  end if;
end; $$;

-- ─────────────────────────────────────────────────────────────────
-- WF5: get_weekly_stats
-- ─────────────────────────────────────────────────────────────────
create or replace function get_weekly_stats(
  p_organization_id uuid,
  p_days            int default 7
)
returns json language plpgsql security definer as $$
declare
  v_since timestamptz := now() - (p_days || ' days')::interval;
begin
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
                    from (select message_type, count(*) as cnt from messages
                          where organization_id = p_organization_id and created_at >= v_since
                          group by message_type) t)
      )
      from messages where organization_id = p_organization_id and created_at >= v_since
    ),
    'attendance', (
      select json_build_object(
        'total',   count(*), 'present', count(*) filter (where status = 'present'),
        'absent',  count(*) filter (where status = 'absent'),
        'tardy',   count(*) filter (where status = 'tardy'),
        'excused', count(*) filter (where status = 'excused')
      ) from attendance where organization_id = p_organization_id and date >= v_since::date
    ),
    'fees', (
      select json_build_object(
        'overdue_count',  count(*) filter (where status = 'overdue'),
        'overdue_amount', coalesce(sum(amount_ntd) filter (where status = 'overdue'), 0),
        'paid_this_week', count(*) filter (where status = 'paid' and paid_date >= v_since::date),
        'paid_amount',    coalesce(sum(amount_ntd) filter (where status = 'paid' and paid_date >= v_since::date), 0)
      ) from fee_records where organization_id = p_organization_id
    ),
    'tasks', (
      select json_build_object(
        'created',   count(*) filter (where created_at >= v_since),
        'completed', count(*) filter (where status = 'completed' and created_at >= v_since),
        'pending',   count(*) filter (where status = 'pending')
      ) from tasks where organization_id = p_organization_id
    )
  );
end; $$;

-- ─────────────────────────────────────────────────────────────────
-- WF6: Emergency escalation waves
-- ─────────────────────────────────────────────────────────────────

create or replace function get_emergency_wave1_staff(
  p_organization_id     uuid,
  p_assigned_teacher_id uuid
)
returns json language plpgsql security definer as $$
begin
  return (
    select json_agg(json_build_object('id', id, 'full_name', full_name, 'push_token', push_token, 'voip_push_token', null))
    from staff
    where organization_id = p_organization_id
      and is_active = true and push_token is not null
      and (id = p_assigned_teacher_id or role in ('director', 'admin'))
  );
end; $$;

create or replace function get_emergency_wave2_staff(p_organization_id uuid)
returns json language plpgsql security definer as $$
begin
  return (
    select json_agg(json_build_object('id', id, 'full_name', full_name, 'push_token', push_token))
    from staff
    where organization_id = p_organization_id
      and is_active = true and push_token is not null
      and role not in ('director', 'admin')
  );
end; $$;

create or replace function get_emergency_wave3_staff(p_organization_id uuid)
returns json language plpgsql security definer as $$
begin
  return (
    select json_agg(json_build_object('id', id, 'full_name', full_name, 'push_token', push_token))
    from staff
    where organization_id = p_organization_id
      and push_token is not null
      and is_active = false
  );
end; $$;
