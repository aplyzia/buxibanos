-- Temporary test function to verify pg_net + trigger work
-- Can be dropped after testing

create or replace function test_pg_net_ping(p_url text)
returns bigint language plpgsql security definer as $$
declare
  v_request_id bigint;
begin
  select net.http_post(
    url     := p_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{"source":"pg_net_test","message":"ping from supabase"}'::jsonb
  ) into v_request_id;
  return v_request_id;
end;
$$;
