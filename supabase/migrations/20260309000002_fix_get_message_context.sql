-- Fix get_message_context: handle null records gracefully
-- Uses individual variables instead of record types to avoid "not assigned" errors

create or replace function get_message_context(
  p_sender_user_id  uuid,
  p_primary_student text,
  p_organization_id uuid
)
returns json
language plpgsql security definer
as $$
declare
  v_parent_id   uuid;
  v_parent_name text;
  v_student_id  uuid;
  v_student_name text;
  v_teacher_id  uuid;
  v_teacher_name text;
  v_teacher_push_token text;
  v_assigned_teacher_id uuid;
begin
  -- Get parent record (optional — sender_user_id may be null for test data)
  if p_sender_user_id is not null then
    select id, full_name
    into v_parent_id, v_parent_name
    from parents
    where supabase_user_id = p_sender_user_id
      and organization_id  = p_organization_id
    limit 1;
  end if;

  -- Get student record (match by display_name or full_name)
  select id, full_name, assigned_teacher_id
  into v_student_id, v_student_name, v_assigned_teacher_id
  from students
  where organization_id = p_organization_id
    and (full_name = p_primary_student or display_name = p_primary_student)
  limit 1;

  -- Get assigned teacher (only if student found and has a teacher)
  if v_assigned_teacher_id is not null then
    select id, full_name, push_token
    into v_teacher_id, v_teacher_name, v_teacher_push_token
    from staff
    where id = v_assigned_teacher_id
    limit 1;
  end if;

  return json_build_object(
    'parent_id',           v_parent_id,
    'parent_name',         v_parent_name,
    'student_id',          v_student_id,
    'student_name',        v_student_name,
    'assigned_teacher_id', v_teacher_id,
    'teacher_name',        v_teacher_name,
    'teacher_push_token',  v_teacher_push_token
  );
end;
$$;
