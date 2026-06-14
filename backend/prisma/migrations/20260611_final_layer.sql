-- ============================================================
--  Jesta — Migration 2026-06-11 (b): Final layer
--  Emergency Gesta · Availability profile · Notification types ·
--  Job lifecycle (cancel / category)
--  Run this in: Supabase Dashboard → SQL Editor → New query
--  Safe to run multiple times (IF NOT EXISTS guards).
--  After running: cd backend && npx prisma generate
-- ============================================================

-- ── NotificationType: the full spec set ──────────────────────────────────────
-- Existing values are kept so old rows stay valid; new code uses the new names.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_APPLICANT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPLICATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PRE_SHIFT_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SHIFT_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NO_SHOW_FALLBACK';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RATING_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EMERGENCY_GESTA';

-- ── jobs: emergency mode + category + cancellation ───────────────────────────

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS "isEmergency" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "basePay"     FLOAT8,            -- original wage before the +20% emergency bonus
  ADD COLUMN IF NOT EXISTS "category"    TEXT,              -- e.g. 'delivery' | 'babysit' | 'events' | ...
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ;       -- employer cancelled the job

-- Emergency jobs are few but always queried first — partial index keeps it free
CREATE INDEX IF NOT EXISTS idx_jobs_emergency
  ON jobs ("isEmergency", "createdAt") WHERE "isEmergency" = true;

-- ── availability (System 2 — weekly availability profile) ────────────────────
-- One row per selected time block. minWage / categories / isOpenToOffers are
-- stored on every row (single source of truth = the latest full save, the API
-- always rewrites all rows of a user atomically).

CREATE TABLE IF NOT EXISTS availability (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "dayOfWeek"      INT         NOT NULL CHECK ("dayOfWeek" BETWEEN 0 AND 6),  -- 0 = Sunday
  "startTime"      TEXT        NOT NULL,   -- "HH:MM" (zero-padded — string compare works)
  "endTime"        TEXT        NOT NULL,   -- "HH:MM"
  "minWage"        FLOAT8      NOT NULL DEFAULT 0,
  categories       TEXT[]      NOT NULL DEFAULT '{}',
  "isOpenToOffers" BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", "dayOfWeek", "startTime")
);
CREATE INDEX IF NOT EXISTS idx_availability_user ON availability ("userId");
CREATE INDEX IF NOT EXISTS idx_availability_open ON availability ("isOpenToOffers") WHERE "isOpenToOffers" = true;

-- RLS (API-only access model — same as all other Jesta tables)
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
