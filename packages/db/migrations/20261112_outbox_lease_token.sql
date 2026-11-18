-- Migration: Add lease_token column and index to donor_notifications for strict worker lease fencing
ALTER TABLE donor_notifications ADD COLUMN IF NOT EXISTS lease_token text;
CREATE INDEX IF NOT EXISTS notifications_lease_token_idx ON donor_notifications(lease_token);

