-- RaktSetu Phase 4: Shared Distributed Security & Reliability State
-- Safe, non-destructive migration for PostgreSQL (Supabase / Render)

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key text PRIMARY KEY,
  requester_id text,
  operation text NOT NULL,
  response_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idempotency_keys_expires_at_idx
  ON idempotency_keys(expires_at);

CREATE TABLE IF NOT EXISTS otp_sessions (
  phone text NOT NULL,
  purpose text NOT NULL,
  hashed_otp text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL,
  last_sent_at timestamptz NOT NULL,
  PRIMARY KEY (phone, purpose)
);

CREATE INDEX IF NOT EXISTS otp_sessions_expires_at_idx
  ON otp_sessions(expires_at);

CREATE TABLE IF NOT EXISTS consumed_ticket_nonces (
  nonce text PRIMARY KEY,
  phone text NOT NULL,
  purpose text NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS consumed_ticket_nonces_phone_idx
  ON consumed_ticket_nonces(phone);
CREATE INDEX IF NOT EXISTS consumed_ticket_nonces_expires_at_idx
  ON consumed_ticket_nonces(expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  key text PRIMARY KEY,
  points integer NOT NULL DEFAULT 1,
  reset_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limit_counters_reset_at_idx
  ON rate_limit_counters(reset_at);

