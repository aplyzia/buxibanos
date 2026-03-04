-- Fix: channel creator cannot SELECT their channel right after INSERT
-- because the existing SELECT policy requires channel_members to exist.
-- This adds a policy allowing the creator to always read their own channels.

CREATE POLICY "staff_read_own_created_channels" ON channels
  FOR SELECT TO authenticated
  USING (
    created_by = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
  );
