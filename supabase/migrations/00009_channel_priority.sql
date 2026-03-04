-- Add priority column to channels for unified inbox filtering
ALTER TABLE channels ADD COLUMN priority TEXT NOT NULL DEFAULT 'low'
  CHECK (priority IN ('high', 'medium', 'low'));
