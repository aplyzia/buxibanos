-- Add completion tracking to tasks table
-- Records which staff member completed/dismissed a task and when

ALTER TABLE tasks
  ADD COLUMN completed_by UUID REFERENCES staff(id),
  ADD COLUMN completed_at TIMESTAMPTZ;

CREATE INDEX idx_tasks_completed_by ON tasks(completed_by) WHERE completed_by IS NOT NULL;
