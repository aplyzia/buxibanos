-- Internal staff messaging: channels, members, messages

-- Channels table (DM or group conversations)
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  created_by UUID NOT NULL REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_channels_org ON channels(organization_id);

-- Channel membership
CREATE TABLE channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, staff_id)
);

CREATE INDEX idx_channel_members_staff ON channel_members(staff_id);
CREATE INDEX idx_channel_members_channel ON channel_members(channel_id);

-- Channel messages
CREATE TABLE channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES staff(id),
  content TEXT NOT NULL,
  media_urls JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_channel_messages_channel ON channel_messages(channel_id, created_at DESC);

-- Enable RLS
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

-- Channels: staff can read channels in their org that they are members of
CREATE POLICY "staff_read_channels" ON channels
  FOR SELECT TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND id IN (
      SELECT channel_id FROM channel_members
      WHERE staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  );

-- Channels: any staff can create channels in their org
CREATE POLICY "staff_create_channels" ON channels
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

-- Channels: update (e.g. name changes) for own org
CREATE POLICY "staff_update_channels" ON channels
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- Channel members: read members of channels you belong to
CREATE POLICY "staff_read_channel_members" ON channel_members
  FOR SELECT TO authenticated
  USING (
    channel_id IN (
      SELECT channel_id FROM channel_members
      WHERE staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  );

-- Channel members: insert (add members to channels in your org)
CREATE POLICY "staff_add_channel_members" ON channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    channel_id IN (
      SELECT id FROM channels WHERE organization_id = get_user_organization_id()
    )
  );

-- Channel members: update own membership (e.g. last_read_at)
CREATE POLICY "staff_update_own_membership" ON channel_members
  FOR UPDATE TO authenticated
  USING (
    staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
  );

-- Channel messages: read messages in channels you belong to
CREATE POLICY "staff_read_channel_messages" ON channel_messages
  FOR SELECT TO authenticated
  USING (
    channel_id IN (
      SELECT channel_id FROM channel_members
      WHERE staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  );

-- Channel messages: insert if you are a member of the channel
CREATE POLICY "staff_send_channel_messages" ON channel_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    AND channel_id IN (
      SELECT channel_id FROM channel_members
      WHERE staff_id = (SELECT id FROM staff WHERE supabase_user_id = auth.uid() LIMIT 1)
    )
  );

-- Enable realtime for channel_messages
ALTER PUBLICATION supabase_realtime ADD TABLE channel_messages;
