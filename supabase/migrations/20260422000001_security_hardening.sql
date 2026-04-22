-- ══════════════════════════════════════════
-- Security hardening: RLS policies for API tables,
-- org validation in channel helpers
-- ══════════════════════════════════════════

-- ── 1. api_keys: add missing RLS policies ─────────────────────────────
-- (RLS was enabled but no policies existed)

CREATE POLICY "staff_read_own_org_keys"
  ON api_keys FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "directors_insert_keys"
  ON api_keys FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM staff
      WHERE supabase_user_id = auth.uid()
        AND role IN ('director', 'admin')
    )
  );

CREATE POLICY "directors_update_keys"
  ON api_keys FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM staff
      WHERE supabase_user_id = auth.uid()
        AND role IN ('director', 'admin')
    )
  );

CREATE POLICY "directors_delete_keys"
  ON api_keys FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM staff
      WHERE supabase_user_id = auth.uid()
        AND role IN ('director', 'admin')
    )
  );

-- ── 2. api_key_usage: enable RLS ──────────────────────────────────────

ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

-- Only service-role (edge functions) touches this table via SECURITY DEFINER RPCs.
-- No direct user access needed.

-- ── 3. agent_api_log: enable RLS + org-scoped read ────────────────────

ALTER TABLE agent_api_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_own_org_logs"
  ON agent_api_log FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Inserts only via service-role (edge functions), no user INSERT policy needed.

-- ── 4. workflow_errors: restrict to director/admin ────────────────────

DROP POLICY IF EXISTS "staff can read own org workflow errors" ON workflow_errors;

CREATE POLICY "directors_read_workflow_errors"
  ON workflow_errors FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM staff
      WHERE supabase_user_id = auth.uid()
        AND role IN ('director', 'admin')
    )
  );

-- ── 5. Harden get_my_channel_ids to validate org membership ──────────

CREATE OR REPLACE FUNCTION get_my_channel_ids()
RETURNS UUID[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(cm.channel_id), '{}')
  FROM channel_members cm
  JOIN staff s ON s.id = cm.staff_id
  WHERE s.supabase_user_id = auth.uid()
    AND s.organization_id = get_user_organization_id();
$$;
