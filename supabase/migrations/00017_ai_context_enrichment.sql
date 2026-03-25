-- Migration: AI Context Enrichment
-- Adds columns that feed richer context to n8n AI workflows (WF1-WF5).
-- - students.nicknames: alternative names/aliases for voice attendance matching (WF3)
-- - students.special_needs: allergies, medical, behavioral notes for AI context (WF1, WF5)
-- - parents.communication_notes: known preferences/concerns for message triage (WF1)
-- - organizations.school_policies: structured school rules for AI prompts

-- ── Students: nicknames for voice attendance matching ────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS nicknames TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.students.nicknames IS 'Alternative names/aliases (e.g. 小明仔, 明明) used by WF3 attendance voice matching';

-- ── Students: special needs for AI awareness ────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS special_needs TEXT DEFAULT NULL;

COMMENT ON COLUMN public.students.special_needs IS 'Allergies, medical conditions, behavioral notes surfaced to AI in WF1/WF5';

-- ── Parents: communication notes ────────────────────────────────────────────
ALTER TABLE public.parents
  ADD COLUMN IF NOT EXISTS communication_notes TEXT DEFAULT NULL;

COMMENT ON COLUMN public.parents.communication_notes IS 'Known preferences/concerns (e.g. prefers text, worried about math grades) used by WF1 triage';

-- ── Organizations: structured school policies for AI prompts ────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS school_policies JSONB DEFAULT '{}';

COMMENT ON COLUMN public.organizations.school_policies IS 'Structured school rules (late_policy, fee_rules, calendar, etc.) injected into AI system prompts';
