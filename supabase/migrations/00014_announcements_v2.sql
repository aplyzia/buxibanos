-- ══════════════════════════════════════════
-- ANNOUNCEMENTS V2: Media, targeting, responses, analytics
-- ══════════════════════════════════════════

-- 1) Extend the existing announcements table
ALTER TABLE announcements
  ADD COLUMN media_urls JSONB DEFAULT '[]',
  ADD COLUMN target_type TEXT DEFAULT 'all' CHECK (target_type IN ('all', 'by_class', 'individual')),
  ADD COLUMN target_class_ids UUID[] DEFAULT '{}',
  ADD COLUMN target_parent_ids UUID[] DEFAULT '{}',
  ADD COLUMN response_options JSONB DEFAULT NULL,
  ADD COLUMN allow_free_text BOOLEAN DEFAULT false,
  ADD COLUMN expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent'));

-- 2) Per-parent tracking table
CREATE TABLE announcement_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parents(id),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'viewed', 'responded', 'dismissed')),
  response_value TEXT DEFAULT NULL,
  free_text_value TEXT DEFAULT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NULL,
  responded_at TIMESTAMPTZ DEFAULT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(announcement_id, parent_id)
);

CREATE INDEX idx_ann_recipients_announcement ON announcement_recipients(announcement_id);
CREATE INDEX idx_ann_recipients_parent ON announcement_recipients(parent_id);
CREATE INDEX idx_ann_recipients_status ON announcement_recipients(status);

-- 3) Auto-update timestamp trigger
CREATE TRIGGER update_announcement_recipients_updated_at
  BEFORE UPDATE ON announcement_recipients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4) Enable RLS
ALTER TABLE announcement_recipients ENABLE ROW LEVEL SECURITY;

-- 5) RLS Policies for announcement_recipients

-- Staff can read all recipients in their org
CREATE POLICY "staff_read_announcement_recipients" ON announcement_recipients
  FOR SELECT TO authenticated
  USING (
    announcement_id IN (
      SELECT id FROM announcements WHERE organization_id = get_user_organization_id()
    )
  );

-- Staff can insert recipients (when publishing)
CREATE POLICY "staff_insert_announcement_recipients" ON announcement_recipients
  FOR INSERT TO authenticated
  WITH CHECK (
    announcement_id IN (
      SELECT id FROM announcements WHERE organization_id = get_user_organization_id()
    )
  );

-- Parents can read their own recipient records
CREATE POLICY "parent_read_own_recipients" ON announcement_recipients
  FOR SELECT TO authenticated
  USING (
    parent_id = get_parent_record()
  );

-- Parents can update their own recipient records (respond, dismiss, view)
CREATE POLICY "parent_update_own_recipients" ON announcement_recipients
  FOR UPDATE TO authenticated
  USING (parent_id = get_parent_record())
  WITH CHECK (parent_id = get_parent_record());

-- 6) Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE announcement_recipients;

-- 7) Add GIN index on students.class_ids for efficient by_class targeting
CREATE INDEX IF NOT EXISTS idx_students_class_ids ON students USING GIN(class_ids);

-- 8) RPC: Populate announcement recipients based on target_type
CREATE OR REPLACE FUNCTION populate_announcement_recipients(p_announcement_id UUID)
RETURNS void AS $$
DECLARE
  v_ann RECORD;
BEGIN
  SELECT * INTO v_ann FROM announcements WHERE id = p_announcement_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_ann.target_type = 'all' THEN
    INSERT INTO announcement_recipients (announcement_id, parent_id)
    SELECT p_announcement_id, p.id
    FROM parents p
    WHERE p.organization_id = v_ann.organization_id
    ON CONFLICT (announcement_id, parent_id) DO NOTHING;

  ELSIF v_ann.target_type = 'by_class' THEN
    INSERT INTO announcement_recipients (announcement_id, parent_id)
    SELECT DISTINCT p_announcement_id, p.id
    FROM parents p
    JOIN students s ON s.id = ANY(p.student_ids)
    WHERE s.organization_id = v_ann.organization_id
      AND s.class_ids && v_ann.target_class_ids
      AND s.enrollment_status = 'active'
    ON CONFLICT (announcement_id, parent_id) DO NOTHING;

  ELSIF v_ann.target_type = 'individual' THEN
    INSERT INTO announcement_recipients (announcement_id, parent_id)
    SELECT p_announcement_id, unnest(v_ann.target_parent_ids)
    ON CONFLICT (announcement_id, parent_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9) RPC: Get announcement analytics summary
CREATE OR REPLACE FUNCTION get_announcement_analytics(p_announcement_id UUID)
RETURNS JSON AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'viewed', COUNT(*) FILTER (WHERE status IN ('viewed', 'responded', 'dismissed')),
    'responded', COUNT(*) FILTER (WHERE status = 'responded'),
    'dismissed', COUNT(*) FILTER (WHERE status = 'dismissed'),
    'pending', COUNT(*) FILTER (WHERE status = 'sent'),
    'response_breakdown', COALESCE(
      (SELECT json_object_agg(response_value, cnt)
       FROM (
         SELECT response_value, COUNT(*) as cnt
         FROM announcement_recipients
         WHERE announcement_id = p_announcement_id
           AND response_value IS NOT NULL
         GROUP BY response_value
       ) sub),
      '{}'::json
    )
  )
  FROM announcement_recipients
  WHERE announcement_id = p_announcement_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 10) Backfill: Create recipient rows for existing announcements (target_type defaults to 'all')
DO $$
DECLARE
  v_ann RECORD;
BEGIN
  FOR v_ann IN SELECT id FROM announcements LOOP
    PERFORM populate_announcement_recipients(v_ann.id);
  END LOOP;
END;
$$;
