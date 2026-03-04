-- Fix: channel_members and channel_messages RLS policies use self-referencing
-- subqueries that can fail due to circular RLS evaluation.
-- Solution: SECURITY DEFINER helper function that bypasses RLS to check membership.

-- Helper: get all channel_ids the current user belongs to (bypasses RLS)
CREATE OR REPLACE FUNCTION get_my_channel_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(
    array_agg(channel_id),
    '{}'::UUID[]
  )
  FROM channel_members
  WHERE staff_id = (
    SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop old policies that use self-referencing subqueries
DROP POLICY IF EXISTS "staff_read_channel_members" ON channel_members;
DROP POLICY IF EXISTS "staff_read_channel_messages" ON channel_messages;
DROP POLICY IF EXISTS "staff_send_channel_messages" ON channel_messages;
DROP POLICY IF EXISTS "staff_read_channels" ON channels;

-- Recreate with SECURITY DEFINER helper (no self-reference)
CREATE POLICY "staff_read_channel_members" ON channel_members
  FOR SELECT TO authenticated
  USING (channel_id = ANY(get_my_channel_ids()));

CREATE POLICY "staff_read_channel_messages" ON channel_messages
  FOR SELECT TO authenticated
  USING (channel_id = ANY(get_my_channel_ids()));

CREATE POLICY "staff_send_channel_messages" ON channel_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    AND channel_id = ANY(get_my_channel_ids())
  );

CREATE POLICY "staff_read_channels" ON channels
  FOR SELECT TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND id = ANY(get_my_channel_ids())
  );
