-- Channel project management: tasks and events

-- Channel tasks (shared checklist)
CREATE TABLE channel_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_to UUID REFERENCES staff(id),
  created_by UUID NOT NULL REFERENCES staff(id),
  is_completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES staff(id),
  completed_at TIMESTAMPTZ,
  is_pinned BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_channel_tasks_channel ON channel_tasks(channel_id);

-- Channel events (deadlines / meetings)
CREATE TABLE channel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES staff(id),
  is_pinned BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_channel_events_channel ON channel_events(channel_id);

-- Enable RLS
ALTER TABLE channel_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_events ENABLE ROW LEVEL SECURITY;

-- Channel tasks: read if member of the channel
CREATE POLICY "members_read_channel_tasks" ON channel_tasks
  FOR SELECT TO authenticated
  USING (
    channel_id IN (
      SELECT channel_id FROM channel_members
      WHERE staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  );

-- Channel tasks: insert if member of the channel
CREATE POLICY "members_create_channel_tasks" ON channel_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    AND channel_id IN (
      SELECT channel_id FROM channel_members
      WHERE staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  );

-- Channel tasks: update if member of the channel
CREATE POLICY "members_update_channel_tasks" ON channel_tasks
  FOR UPDATE TO authenticated
  USING (
    channel_id IN (
      SELECT channel_id FROM channel_members
      WHERE staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    channel_id IN (
      SELECT channel_id FROM channel_members
      WHERE staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  );

-- Channel tasks: delete if member of the channel
CREATE POLICY "members_delete_channel_tasks" ON channel_tasks
  FOR DELETE TO authenticated
  USING (
    channel_id IN (
      SELECT channel_id FROM channel_members
      WHERE staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  );

-- Channel events: read if member of the channel
CREATE POLICY "members_read_channel_events" ON channel_events
  FOR SELECT TO authenticated
  USING (
    channel_id IN (
      SELECT channel_id FROM channel_members
      WHERE staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  );

-- Channel events: insert if member of the channel
CREATE POLICY "members_create_channel_events" ON channel_events
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    AND channel_id IN (
      SELECT channel_id FROM channel_members
      WHERE staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  );

-- Channel events: update if member of the channel
CREATE POLICY "members_update_channel_events" ON channel_events
  FOR UPDATE TO authenticated
  USING (
    channel_id IN (
      SELECT channel_id FROM channel_members
      WHERE staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    channel_id IN (
      SELECT channel_id FROM channel_members
      WHERE staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  );

-- Channel events: delete if member of the channel
CREATE POLICY "members_delete_channel_events" ON channel_events
  FOR DELETE TO authenticated
  USING (
    channel_id IN (
      SELECT channel_id FROM channel_members
      WHERE staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE channel_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE channel_events;
