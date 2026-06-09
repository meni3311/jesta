-- ============================================================
--  Jesta — Supabase SQL DDL
--  Run this in: Supabase Dashboard → SQL Editor → New query
--  It is safe to run multiple times (uses IF NOT EXISTS / DO $$)
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('WORKER', 'EMPLOYER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── users ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT          NOT NULL UNIQUE,
  phone          TEXT,
  "passwordHash" TEXT          NOT NULL,
  role           "UserRole"    NOT NULL,
  "fullName"     TEXT          NOT NULL,
  "avatarUrl"    TEXT,
  rating         FLOAT8        NOT NULL DEFAULT 0,
  "completedJobs" INT          NOT NULL DEFAULT 0,
  "isVerified"                BOOLEAN       NOT NULL DEFAULT false,
  "emailVerificationToken"    TEXT,
  "emailVerificationExpiry"   TIMESTAMPTZ,
  "createdAt"                 TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"                 TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Add verification columns if the table already exists (safe re-run)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "emailVerificationToken"  TEXT,
  ADD COLUMN IF NOT EXISTS "emailVerificationExpiry" TIMESTAMPTZ;

-- ── jobs ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jobs (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "employerId"  UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT          NOT NULL,
  description   TEXT,
  pay           FLOAT8        NOT NULL,          -- hourly rate in NIS
  address       TEXT          NOT NULL,
  lat           FLOAT8        NOT NULL,
  lng           FLOAT8        NOT NULL,
  "startTime"   TIMESTAMPTZ   NOT NULL,
  "endTime"     TIMESTAMPTZ   NOT NULL,
  "isActive"    BOOLEAN       NOT NULL DEFAULT true,
  perks         TEXT[]        NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── applications ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS applications (
  id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobId"     UUID                NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  "workerId"  UUID                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  UNIQUE ("jobId", "workerId")    -- one application per worker per job
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_jobs_employer   ON jobs ("employerId");
CREATE INDEX IF NOT EXISTS idx_jobs_active     ON jobs ("isActive");
CREATE INDEX IF NOT EXISTS idx_jobs_location   ON jobs (lat, lng);
CREATE INDEX IF NOT EXISTS idx_apps_job        ON applications ("jobId");
CREATE INDEX IF NOT EXISTS idx_apps_worker     ON applications ("workerId");

-- ── Auto-update updatedAt trigger ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
