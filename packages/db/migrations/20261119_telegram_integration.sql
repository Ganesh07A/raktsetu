-- Migration: Telegram Donor Notification Integration (Phase 1, 2, 3)
-- Tables: donor_telegram_subscriptions, telegram_link_tokens, telegram_notifications

CREATE TABLE IF NOT EXISTS donor_telegram_subscriptions (
  id text PRIMARY KEY,
  donor_id text NOT NULL UNIQUE REFERENCES donor_profiles(id) ON DELETE CASCADE,
  telegram_chat_id text NOT NULL UNIQUE,
  telegram_user_id text,
  telegram_username text,
  alerts_enabled boolean NOT NULL DEFAULT true,
  linked_at timestamp with time zone NOT NULL DEFAULT now(),
  unlinked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS donor_tg_chat_id_idx ON donor_telegram_subscriptions(telegram_chat_id);
CREATE INDEX IF NOT EXISTS donor_tg_donor_id_idx ON donor_telegram_subscriptions(donor_id);

CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token_hash text PRIMARY KEY,
  donor_id text NOT NULL REFERENCES donor_profiles(id) ON DELETE CASCADE,
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Idempotent column rename if an older version of the table had 'token' instead of 'token_hash'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'telegram_link_tokens' AND column_name = 'token'
  ) THEN
    ALTER TABLE telegram_link_tokens RENAME COLUMN token TO token_hash;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tg_link_tokens_donor_idx ON telegram_link_tokens(donor_id);
CREATE INDEX IF NOT EXISTS tg_link_tokens_expires_idx ON telegram_link_tokens(expires_at);

CREATE TABLE IF NOT EXISTS telegram_notifications (
  id text PRIMARY KEY,
  request_id text NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  donor_id text NOT NULL REFERENCES donor_profiles(id) ON DELETE CASCADE,
  telegram_chat_id text NOT NULL,
  telegram_message_id integer,
  callback_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamp with time zone,
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tg_notif_req_donor_idx ON telegram_notifications(request_id, donor_id);
CREATE INDEX IF NOT EXISTS tg_notif_callback_idx ON telegram_notifications(callback_id);
CREATE INDEX IF NOT EXISTS tg_notif_chat_msg_idx ON telegram_notifications(telegram_chat_id, telegram_message_id);
