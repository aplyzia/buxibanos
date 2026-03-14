-- Fix search_path in all SECURITY DEFINER functions so they find public schema tables

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
  v_parent_id           uuid;
  v_parent_name         text;
  v_student_id          uuid;
  v_student_name        text;
  v_teacher_id          uuid;
  v_teacher_name        text;
  v_teacher_push_token  text;
  v_assigned_teacher_id uuid;
begin
  if p_sender_user_id is not null then
    select id, full_name
    into v_parent_id, v_parent_name
    from public.parents
    where supabase_user_id = p_sender_user_id
      and organization_id  = p_organization_id
    limit 1;
  end if;

  select id, full_name, assigned_teacher_id
  into v_student_id, v_student_name, v_assigned_teacher_id
  from public.students
  where organization_id = p_organization_id
    and (full_name = p_primary_student or display_name = p_primary_student)
  limit 1;

  if v_assigned_teacher_id is not null then
    select id, full_name, push_token
    into v_teacher_id, v_teacher_name, v_teacher_push_token
    from public.staff
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

-- Also fix get_director_push_tokens
create or replace function get_director_push_tokens(p_organization_id uuid)
returns json language plpgsql security definer
set search_path = public
as $$
begin
  return (
    select json_agg(json_build_object('push_token', push_token))
    from public.staff
    where organization_id = p_organization_id
      and role in ('director', 'admin')
      and is_active = true
      and push_token is not null
      and notification_pref in ('all', 'urgent_only', 'urgent_and_digest')
  );
end; $$;
