-- Allow staff to remove members from channels they belong to
-- (channel creator can remove others, any member can remove themselves)
CREATE POLICY "staff_delete_channel_members" ON channel_members
  FOR DELETE TO authenticated
  USING (
    -- Can remove yourself from any channel
    staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    OR
    -- Channel creator can remove anyone
    channel_id IN (
      SELECT id FROM channels
      WHERE created_by = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  );
