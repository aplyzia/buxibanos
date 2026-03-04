-- Add reply_to column for quote replies
ALTER TABLE channel_messages ADD COLUMN reply_to_id UUID REFERENCES channel_messages(id);

-- Add deleted_at for soft-delete (unsend)
ALTER TABLE channel_messages ADD COLUMN deleted_at TIMESTAMPTZ;

-- Allow staff to UPDATE their own messages (for soft-delete/unsend)
CREATE POLICY "staff_update_own_channel_messages" ON channel_messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    sender_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
  );
