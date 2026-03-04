-- Add source tracking columns to attendance table
-- Enables distinguishing manual staff entries from AI auto-detected entries

ALTER TABLE attendance
  ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'auto_message')),
  ADD COLUMN source_message_id UUID REFERENCES messages(id);
