-- ══════════════════════════════════════════
-- Agent API: API keys, rate limiting, audit log
-- ══════════════════════════════════════════

-- ── API Keys ────────────────────────────────────────────────────────
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'default',
  scopes TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  rate_limit_per_minute INT DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- ── Rate Limiting ───────────────────────────────────────────────────
CREATE TABLE api_key_usage (
  key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INT DEFAULT 1,
  PRIMARY KEY (key_id, window_start)
);

-- ── Audit Log ───────────────────────────────────────────────────────
CREATE TABLE agent_api_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID REFERENCES api_keys(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  request_body JSONB,
  response_status INT,
  response_summary TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_api_log_org ON agent_api_log(organization_id, created_at DESC);
CREATE INDEX idx_api_log_key ON agent_api_log(key_id, created_at DESC);

-- ── RPC: Validate API key ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_api_key(p_key_hash TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key RECORD;
  v_window TIMESTAMPTZ;
  v_count INT;
BEGIN
  SELECT * INTO v_key FROM api_keys
  WHERE key_hash = p_key_hash AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid API key');
  END IF;

  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < now() THEN
    RETURN json_build_object('valid', false, 'error', 'API key expired');
  END IF;

  -- Rate limit: current minute window
  v_window := date_trunc('minute', now());

  INSERT INTO api_key_usage (key_id, window_start, request_count)
  VALUES (v_key.id, v_window, 1)
  ON CONFLICT (key_id, window_start) DO UPDATE
    SET request_count = api_key_usage.request_count + 1
  RETURNING request_count INTO v_count;

  IF v_count > v_key.rate_limit_per_minute THEN
    RETURN json_build_object('valid', false, 'error', 'Rate limit exceeded');
  END IF;

  -- Update last_used_at
  UPDATE api_keys SET last_used_at = now() WHERE id = v_key.id;

  RETURN json_build_object(
    'valid', true,
    'key_id', v_key.id,
    'organization_id', v_key.organization_id,
    'label', v_key.label,
    'scopes', v_key.scopes
  );
END;
$$;

-- ── RPC: Cleanup old usage + logs ───────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_api_key_usage()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM api_key_usage WHERE window_start < now() - interval '1 hour';
  DELETE FROM agent_api_log WHERE created_at < now() - interval '90 days';
$$;
