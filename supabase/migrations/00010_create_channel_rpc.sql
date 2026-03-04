-- RPC function to atomically create a channel + members in one call.
-- Uses SECURITY DEFINER to bypass RLS chicken-and-egg issue where
-- the channel_members INSERT policy needs to SELECT the channel,
-- but the channel SELECT policy needs channel_members to exist.

CREATE OR REPLACE FUNCTION create_channel_with_members(
  p_organization_id UUID,
  p_name TEXT,
  p_type TEXT,
  p_created_by UUID,
  p_member_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
  v_channel_id UUID;
  v_member_id UUID;
BEGIN
  -- Validate type
  IF p_type NOT IN ('direct', 'group') THEN
    RAISE EXCEPTION 'Invalid channel type: %', p_type;
  END IF;

  -- Validate the creator belongs to the organization
  IF NOT EXISTS (
    SELECT 1 FROM staff
    WHERE id = p_created_by
      AND organization_id = p_organization_id
      AND supabase_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: staff does not belong to organization';
  END IF;

  -- Create channel
  INSERT INTO channels (organization_id, name, type, created_by)
  VALUES (p_organization_id, p_name, p_type, p_created_by)
  RETURNING id INTO v_channel_id;

  -- Add creator as member
  INSERT INTO channel_members (channel_id, staff_id)
  VALUES (v_channel_id, p_created_by)
  ON CONFLICT (channel_id, staff_id) DO NOTHING;

  -- Add other members
  FOREACH v_member_id IN ARRAY p_member_ids
  LOOP
    IF v_member_id != p_created_by THEN
      INSERT INTO channel_members (channel_id, staff_id)
      VALUES (v_channel_id, v_member_id)
      ON CONFLICT (channel_id, staff_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
