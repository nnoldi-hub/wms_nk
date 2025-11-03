-- Fix: Align picking-related UUID defaults to use uuid_generate_v4()
-- Rationale: Earlier migration 018 used gen_random_uuid(), which may be unavailable if pgcrypto isn't enabled.
-- We standardize on uuid-ossp's uuid_generate_v4() which is already used elsewhere.

-- Ensure extension exists (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Update defaults on picking tables
ALTER TABLE IF EXISTS picking_jobs
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

ALTER TABLE IF EXISTS picking_job_items
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

ALTER TABLE IF EXISTS inventory_reservations
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();
