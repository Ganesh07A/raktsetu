-- Migration: 20261112_blood_requests_matched_banks.sql
-- Checkpoint 4.2: Ensure blood_requests matched bank fields exist in PostgreSQL

ALTER TABLE blood_requests
  ADD COLUMN IF NOT EXISTS matched_bank_id TEXT,
  ADD COLUMN IF NOT EXISTS matched_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS matched_bank_phone TEXT,
  ADD COLUMN IF NOT EXISTS matched_bank_address TEXT,
  ADD COLUMN IF NOT EXISTS matched_bank_distance_km DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS matched_bank_provenance TEXT,
  ADD COLUMN IF NOT EXISTS matched_bank_verification_status TEXT;

