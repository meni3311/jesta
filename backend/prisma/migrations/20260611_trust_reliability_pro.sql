-- ============================================================
--  Jesta — Migration 2026-06-11: Trust & Rating · Reliability · Pro plan
--  Run this in: Supabase Dashboard → SQL Editor → New query
--  Safe to run multiple times (IF NOT EXISTS / DO $$ guards).
--  After running: cd backend && npx prisma generate
-- ============================================================

-- ── New enums ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'CONFIRM_SHIFT', 'CONFIRM_SHIFT_URGENT', 'JOB_REOPENED',
    'RATE_REQUEST', 'DIRECT_OFFER', 'OFFER_RESPONSE', 'GENERAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── users: trust, reliability + pro columns ──────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "ratingCount"      INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "jestaScore"       FLOAT8      NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "showUpCount"      INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "noShowCount"      INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "responseCount"    INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "responseTotalMin" FLOAT8      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "warningFlag"      BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "suspendedUntil"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "reviewFlag"       BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isPro"            BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "proFeatures"      JSONB       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "availability"     JSONB;

-- ── jobs: insurance mode ──────────────────────────────────────────────────────

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS "isInsured" BOOLEAN NOT NULL DEFAULT false;

-- ── applications: reliability timestamps ─────────────────────────────────────

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS "autoRejected"       BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "approvedAt"         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "confirmedAt"        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "noShowAt"           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "completedAt"        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "preShiftNotifiedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "urgentNotifiedAt"   TIMESTAMPTZ;

-- ── ratings ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ratings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobId"      UUID        NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
  "fromUserId" UUID        NOT NULL REFERENCES users(id),
  "toUserId"   UUID        NOT NULL REFERENCES users(id),
  score        INT         NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment      TEXT        CHECK (char_length(comment) <= 100),
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("jobId", "fromUserId")          -- one rating per rater per gesta
);
CREATE INDEX IF NOT EXISTS idx_ratings_to_user ON ratings ("toUserId");

-- ── notifications ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"        UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            "NotificationType" NOT NULL,
  title           TEXT               NOT NULL,
  body            TEXT,
  "jobId"         UUID,              -- loose references (no FK)
  "applicationId" UUID,
  "offerId"       UUID,
  "isRead"        BOOLEAN            NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read    ON notifications ("userId", "isRead");
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications ("userId", "createdAt");

-- ── job_offers (Pro direct hiring) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_offers (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobId"       UUID          NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  "employerId"  UUID          NOT NULL REFERENCES users(id),
  "workerId"    UUID          NOT NULL REFERENCES users(id),
  status        "OfferStatus" NOT NULL DEFAULT 'PENDING',
  message       TEXT,
  "createdAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "respondedAt" TIMESTAMPTZ,
  UNIQUE ("jobId", "workerId")            -- one offer per worker per job
);
CREATE INDEX IF NOT EXISTS idx_job_offers_worker_status ON job_offers ("workerId", status);

-- ── RLS (API-only access model — same as all other Jesta tables) ─────────────

ALTER TABLE ratings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_offers    ENABLE ROW LEVEL SECURITY;
