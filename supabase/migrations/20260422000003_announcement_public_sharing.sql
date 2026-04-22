-- ══════════════════════════════════════════
-- ANNOUNCEMENT PUBLIC SHARING
-- Adds is_public flag + short URL slug so staff can share announcements
-- to Facebook, LINE, and their website via an unauthenticated web page.
-- ══════════════════════════════════════════

ALTER TABLE announcements
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN public_slug TEXT UNIQUE;

CREATE INDEX idx_announcements_public_slug ON announcements(public_slug)
  WHERE public_slug IS NOT NULL;

-- RPC: toggle public sharing for an announcement. Generates a short random
-- slug on first activation; reuses the existing slug on re-activation so
-- previously-shared links keep working.
CREATE OR REPLACE FUNCTION set_announcement_public(
  p_announcement_id UUID,
  p_is_public BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_existing_slug TEXT;
  v_new_slug TEXT;
  v_user_org UUID;
BEGIN
  -- Enforce org scoping: caller must belong to the same org as the announcement
  v_user_org := get_user_organization_id();
  IF v_user_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id, public_slug
    INTO v_org_id, v_existing_slug
    FROM announcements
   WHERE id = p_announcement_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Announcement not found';
  END IF;

  IF v_org_id <> v_user_org THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_is_public = false THEN
    UPDATE announcements SET is_public = false WHERE id = p_announcement_id;
    RETURN NULL;
  END IF;

  -- Activating: reuse existing slug if present, else generate one
  IF v_existing_slug IS NOT NULL THEN
    UPDATE announcements SET is_public = true WHERE id = p_announcement_id;
    RETURN v_existing_slug;
  END IF;

  -- Generate a short random slug (8 base36 chars, ~41 bits of entropy)
  LOOP
    v_new_slug := lower(substr(md5(gen_random_uuid()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM announcements WHERE public_slug = v_new_slug);
  END LOOP;

  UPDATE announcements
     SET is_public = true, public_slug = v_new_slug
   WHERE id = p_announcement_id;

  RETURN v_new_slug;
END;
$$;

REVOKE ALL ON FUNCTION set_announcement_public(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_announcement_public(UUID, BOOLEAN) TO authenticated;

-- RPC: fetch public announcement by slug. Returns NULL if not found or not public.
-- Called from the edge function with service role, but safe to expose: it only
-- returns rows explicitly marked is_public=true.
CREATE OR REPLACE FUNCTION get_public_announcement(p_slug TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  body TEXT,
  created_at TIMESTAMPTZ,
  media_urls JSONB,
  organization_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT a.id, a.title, a.body, a.created_at, a.media_urls, o.name
    FROM announcements a
    JOIN organizations o ON o.id = a.organization_id
   WHERE a.public_slug = p_slug
     AND a.is_public = true
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_public_announcement(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_announcement(TEXT) TO anon, authenticated, service_role;
