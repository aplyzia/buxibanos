-- BuxibanOS Initial Schema
-- Based on Technical Specification v1 (Feb 2026)
-- Run: supabase db push

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ══════════════════════════════════════════
-- ORGANIZATIONS
-- ══════════════════════════════════════════
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  google_drive_folder_id TEXT,
  notification_config JSONB DEFAULT '{}',  -- push prefs, digest schedule
  subscription_tier TEXT DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════
-- STAFF
-- ══════════════════════════════════════════
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('director', 'teacher', 'admin', 'front_desk')),
  supabase_user_id UUID NOT NULL REFERENCES auth.users(id),
  push_token TEXT,                          -- Expo Push Token for server-initiated notifications
  notification_pref TEXT DEFAULT 'all' CHECK (notification_pref IN ('all', 'urgent_only', 'urgent_and_digest', 'digest_only')),
  is_active BOOLEAN DEFAULT true,
  subjects TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_staff_org ON staff(organization_id);
CREATE INDEX idx_staff_user ON staff(supabase_user_id);

-- ══════════════════════════════════════════
-- STUDENTS
-- ══════════════════════════════════════════
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  full_name TEXT NOT NULL,
  display_name TEXT,
  grade_level TEXT NOT NULL,
  class_ids UUID[] DEFAULT '{}',
  assigned_teacher_id UUID REFERENCES staff(id),
  enrollment_status TEXT DEFAULT 'active' CHECK (enrollment_status IN ('active', 'paused', 'withdrawn')),
  enrollment_date DATE NOT NULL,
  marketing_consent BOOLEAN DEFAULT false,
  grade_records JSONB DEFAULT '{}',        -- V2 stub
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_students_org ON students(organization_id);
CREATE INDEX idx_students_teacher ON students(assigned_teacher_id);
CREATE INDEX idx_students_status ON students(organization_id, enrollment_status);

-- ══════════════════════════════════════════
-- PARENTS
-- ══════════════════════════════════════════
CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  full_name TEXT NOT NULL,
  email TEXT,                               -- used for email/password fallback auth
  phone TEXT,
  app_user_id TEXT,                         -- Line user ID (from Line Login OAuth) OR Supabase Auth UUID
  invite_code TEXT,                         -- unique code sent to parent for onboarding
  supabase_user_id UUID REFERENCES auth.users(id),
  push_token TEXT,                          -- Expo Push Token for notifications
  student_ids UUID[] NOT NULL DEFAULT '{}',
  notification_pref TEXT DEFAULT 'urgent_and_digest' CHECK (notification_pref IN ('all', 'urgent_only', 'urgent_and_digest', 'digest_only')),
  preferred_language TEXT DEFAULT 'zh-TW',
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parents_org ON parents(organization_id);
CREATE UNIQUE INDEX idx_parents_email ON parents(organization_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_parents_invite ON parents(organization_id, invite_code) WHERE invite_code IS NOT NULL;
CREATE UNIQUE INDEX idx_parents_app_user ON parents(organization_id, app_user_id) WHERE app_user_id IS NOT NULL;

-- ══════════════════════════════════════════
-- CLASSES
-- ══════════════════════════════════════════
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  subject TEXT NOT NULL CHECK (subject IN ('math', 'english', 'science', 'chinese', 'other')),
  teacher_id UUID NOT NULL REFERENCES staff(id),
  schedule JSONB DEFAULT '{}',
  max_students INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════
-- MESSAGES
-- ══════════════════════════════════════════
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  thread_id UUID,                           -- FK → conversation threads (V2 formalized; nullable in V1)
  sender_name TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('parent', 'teacher', 'student', 'admin')),
  sender_user_id UUID REFERENCES auth.users(id),
  receiver_name TEXT NOT NULL,
  receiver_type TEXT NOT NULL CHECK (receiver_type IN ('parent', 'teacher', 'student', 'admin')),
  primary_student TEXT,
  additional_students TEXT[] DEFAULT '{}',
  message_type TEXT NOT NULL CHECK (message_type IN ('attendance', 'payment', 'schedule', 'complaint', 'inquiry', 'emergency', 'general')),
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  action_required BOOLEAN DEFAULT false,
  summary TEXT,
  context TEXT,
  original_content TEXT NOT NULL,
  media_urls JSONB DEFAULT '[]',            -- Supabase Storage URLs for voice notes, photos, files
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  reasoning TEXT,
  staff_responded BOOLEAN DEFAULT false,
  response_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_org ON messages(organization_id);
CREATE INDEX idx_messages_priority ON messages(organization_id, priority) WHERE NOT staff_responded;
CREATE INDEX idx_messages_student ON messages(organization_id, primary_student);
CREATE INDEX idx_messages_date ON messages(organization_id, processed_at DESC);

-- ══════════════════════════════════════════
-- DOCUMENTS
-- ══════════════════════════════════════════
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('handout', 'policy', 'form', 'report', 'other')),
  summary TEXT,
  tags TEXT[] DEFAULT '{}',
  file_url TEXT NOT NULL,
  drive_file_id TEXT,
  mime_type TEXT NOT NULL,
  extracted_text TEXT,
  embedding vector(1536),
  uploaded_by UUID NOT NULL REFERENCES staff(id),
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_documents_org ON documents(organization_id);

-- ══════════════════════════════════════════
-- FEE RECORDS
-- ══════════════════════════════════════════
CREATE TABLE fee_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  student_id UUID NOT NULL REFERENCES students(id),
  period TEXT NOT NULL,
  amount_ntd INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'waived')),
  due_date DATE NOT NULL,
  paid_date DATE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'other')),
  notes TEXT,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fees_org ON fee_records(organization_id);
CREATE INDEX idx_fees_student ON fee_records(student_id);
CREATE INDEX idx_fees_overdue ON fee_records(organization_id, status) WHERE status = 'overdue';

-- ══════════════════════════════════════════
-- ATTENDANCE
-- ══════════════════════════════════════════
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  student_id UUID NOT NULL REFERENCES students(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'tardy', 'excused')),
  recorded_by UUID NOT NULL REFERENCES staff(id),
  parent_notified BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_attendance_student ON attendance(student_id, date DESC);
CREATE INDEX idx_attendance_class ON attendance(class_id, date);
CREATE UNIQUE INDEX idx_attendance_unique ON attendance(student_id, class_id, date);

-- ══════════════════════════════════════════
-- TASKS (AI-generated + manual + system)
-- ══════════════════════════════════════════
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('ai_detected', 'manual', 'system')),
  source_message_id UUID REFERENCES messages(id),
  source_student_id UUID REFERENCES students(id),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
  assigned_to UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tasks_org ON tasks(organization_id);
CREATE INDEX idx_tasks_pending ON tasks(organization_id, status) WHERE status = 'pending';

-- ══════════════════════════════════════════
-- PHOTO MEDIA (simplified V1)
-- ══════════════════════════════════════════
CREATE TABLE photo_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  event_name TEXT,
  class_id UUID REFERENCES classes(id),
  tags JSONB DEFAULT '{}',
  student_ids UUID[] DEFAULT '{}',
  consent_verified BOOLEAN DEFAULT false,
  uploaded_by UUID NOT NULL REFERENCES staff(id),
  captured_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_media ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's organization_id
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM staff WHERE supabase_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM staff WHERE supabase_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is a parent (matched by supabase_user_id)
CREATE OR REPLACE FUNCTION get_parent_record()
RETURNS UUID AS $$
  SELECT id FROM parents WHERE supabase_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Staff policies
CREATE POLICY "staff_read_own_org" ON organizations
  FOR SELECT TO authenticated
  USING (id = get_user_organization_id());

CREATE POLICY "staff_read_staff" ON staff
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "staff_read_students" ON students
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "staff_manage_students" ON students
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "staff_read_parents" ON parents
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "staff_read_messages" ON messages
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "staff_manage_messages" ON messages
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "staff_read_classes" ON classes
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "staff_read_documents" ON documents
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "staff_manage_fees" ON fee_records
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "staff_manage_attendance" ON attendance
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "staff_manage_tasks" ON tasks
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- Parent policies: read own children's data only
CREATE POLICY "parent_read_own_children" ON students
  FOR SELECT TO authenticated
  USING (
    id = ANY(
      SELECT unnest(student_ids) FROM parents
      WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "parent_read_own_fees" ON fee_records
  FOR SELECT TO authenticated
  USING (
    student_id = ANY(
      SELECT unnest(student_ids) FROM parents
      WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "parent_read_own_attendance" ON attendance
  FOR SELECT TO authenticated
  USING (
    student_id = ANY(
      SELECT unnest(student_ids) FROM parents
      WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "parent_read_published_documents" ON documents
  FOR SELECT TO authenticated
  USING (
    is_published = true AND
    organization_id = (
      SELECT organization_id FROM parents WHERE supabase_user_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "parent_insert_messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid() AND
    organization_id = (
      SELECT organization_id FROM parents WHERE supabase_user_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "parent_read_own_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    sender_user_id = auth.uid() OR
    organization_id = (
      SELECT organization_id FROM parents WHERE supabase_user_id = auth.uid() LIMIT 1
    )
  );

-- ══════════════════════════════════════════
-- AUTO-UPDATE TIMESTAMPS
-- ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organizations', 'staff', 'students', 'parents', 'classes',
    'messages', 'documents', 'fee_records', 'attendance', 'tasks', 'photo_media'
  ]) LOOP
    EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
  END LOOP;
END;
$$;

-- ══════════════════════════════════════════
-- ENABLE REALTIME
-- ══════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
