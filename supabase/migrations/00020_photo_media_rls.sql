-- ══════════════════════════════════════════
-- photo_media: add RLS policies (V2 stub table)
-- Table had RLS enabled but zero policies defined
-- ══════════════════════════════════════════

CREATE POLICY "staff_read_own_org_photos"
  ON photo_media FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "staff_insert_own_org_photos"
  ON photo_media FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "staff_update_own_org_photos"
  ON photo_media FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "staff_delete_own_org_photos"
  ON photo_media FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM staff
      WHERE supabase_user_id = auth.uid()
        AND role IN ('director', 'admin')
    )
  );
