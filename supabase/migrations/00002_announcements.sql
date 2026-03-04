-- Announcements table for school-wide broadcasts
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_announcements_org ON announcements(organization_id);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Staff can manage announcements in their org
CREATE POLICY "staff_manage_announcements" ON announcements
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- Parents can read announcements in their org
CREATE POLICY "parent_read_announcements" ON announcements
  FOR SELECT TO authenticated
  USING (
    organization_id = (
      SELECT organization_id FROM parents WHERE supabase_user_id = auth.uid() LIMIT 1
    )
  );

-- Auto-update timestamp trigger
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
