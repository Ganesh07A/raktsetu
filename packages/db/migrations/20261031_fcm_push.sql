-- RaktSetu Phase 1: Firebase Web Push subscriptions.
-- Apply once in Supabase SQL Editor before deploying the updated API.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'donor_notifications' AND column_name = 'whatsapp_message_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'donor_notifications' AND column_name = 'push_message_id'
  ) THEN
    ALTER TABLE donor_notifications RENAME COLUMN whatsapp_message_id TO push_message_id;
  END IF;
END $;

DO $
BEGIN
  IF to_regclass('public.notifications_whatsapp_id_idx') IS NOT NULL
     AND to_regclass('public.notifications_push_id_idx') IS NULL THEN
    ALTER INDEX notifications_whatsapp_id_idx RENAME TO notifications_push_id_idx;
  END IF;
END $;

ALTER TABLE donor_profiles DROP COLUMN IF EXISTS whatsapp_consent;

-- DROP COLUMN removes the previous composite index that included whatsapp_consent.
CREATE INDEX IF NOT EXISTS donor_blood_available_idx
  ON donor_profiles(blood_group, is_available);

CREATE TABLE IF NOT EXISTS donor_push_subscriptions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  donor_id text NOT NULL REFERENCES donor_profiles(id) ON DELETE CASCADE,
  fcm_token text NOT NULL,
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS donor_push_subscriptions_donor_idx
  ON donor_push_subscriptions(donor_id);
CREATE UNIQUE INDEX IF NOT EXISTS donor_push_subscriptions_token_uidx
  ON donor_push_subscriptions(fcm_token);
