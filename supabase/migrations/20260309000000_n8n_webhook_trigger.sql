-- n8n Webhook Trigger for WF1 (Message Triage)
-- Uses pg_net to POST to n8n whenever a message is inserted.
-- The webhook URL is stored in n8n_webhook_settings so it can be
-- updated via REST API each dev session (localtunnel URL changes).

-- ── Settings table ────────────────────────────────────────────────
create table if not exists n8n_webhook_settings (
  key   text primary key,
  value text not null
);

-- Seed with placeholder; will be overwritten by the setup script
insert into n8n_webhook_settings (key, value)
values ('wf1_url', 'https://FILL_IN/webhook/message-triage')
on conflict (key) do nothing;

-- ── Enable pg_net ─────────────────────────────────────────────────
create extension if not exists pg_net;

-- ── Trigger function ──────────────────────────────────────────────
create or replace function trigger_wf1_message_triage()
returns trigger language plpgsql security definer as $$
declare
  v_url text;
begin
  select value into v_url
  from n8n_webhook_settings
  where key = 'wf1_url';

  -- Only fire if URL is configured (not the placeholder)
  if v_url is not null and v_url not like '%FILL_IN%' then
    perform net.http_post(
      url     := v_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := row_to_json(NEW)::jsonb
    );
  end if;

  return NEW;
end;
$$;

-- ── Attach trigger ────────────────────────────────────────────────
drop trigger if exists wf1_message_triage_trigger on public.messages;
create trigger wf1_message_triage_trigger
  after insert on public.messages
  for each row execute function trigger_wf1_message_triage();
