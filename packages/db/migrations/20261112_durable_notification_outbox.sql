-- Migration: 20261112_durable_notification_outbox.sql
-- Checkpoint 4.2: Durable Notification Outbox Recovery & Atomic Worker Claiming

ALTER TABLE donor_notifications
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_details TEXT;

CREATE INDEX IF NOT EXISTS notifications_outbox_queue_idx
  ON donor_notifications (status, next_retry_at)
  WHERE status IN ('pending', 'processing');

