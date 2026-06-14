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
  "requiredWorkers" INT       NOT NULL DEFAULT 1,
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

-- Add requiredWorkers if the table already exists (safe re-run)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS "requiredWorkers" INT NOT NULL DEFAULT 1;

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

-- ── chats ─────────────────────────────────────────────────────────────────────
-- One chat per approved application (created by the backend on approval).

CREATE TABLE IF NOT EXISTS chats (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "applicationId" UUID        NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  "employerId"    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "workerId"      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── messages ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "chatId"    UUID        NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  "senderId"  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chats_employer  ON chats ("employerId");
CREATE INDEX IF NOT EXISTS idx_chats_worker    ON chats ("workerId");
CREATE INDEX IF NOT EXISTS idx_messages_chat   ON messages ("chatId", "createdAt");

-- ── Row Level Security ────────────────────────────────────────────────────────
-- The NestJS backend connects via the Postgres connection string (Prisma) and
-- is NOT subject to RLS. The browser only holds the ANON key, so enabling RLS
-- with no anon policies makes all tables unreadable from the client — exactly
-- what we want: ALL data access goes through the authenticated NestJS API.
-- (Realtime chat uses Broadcast channels, not postgres_changes, so it does
-- not require anon SELECT access.)

ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages     ENABLE ROW LEVEL SECURITY;

-- ── Storage: avatars bucket ───────────────────────────────────────────────────
-- Public-read bucket. The backend uploads with the service-role key (bypasses
-- policies). The anon INSERT policy below allows the registration screen to
-- upload an avatar before the user has an account/token.

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "avatars_public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_anon_upload"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
--  2026-06-11 — Trust & Rating · Reliability · Pro plan
--  (identical to 20260611_trust_reliability_pro.sql — kept in
--   both places so a fresh install needs only this file)
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

-- ============================================================
--  2026-06-11 (b) — Final layer: Emergency Gesta · Availability ·
--  Notification types · Job lifecycle
--  (identical to migrations/20260611_final_layer.sql)
-- ============================================================

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_APPLICANT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPLICATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PRE_SHIFT_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SHIFT_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NO_SHOW_FALLBACK';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RATING_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EMERGENCY_GESTA';

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS "isEmergency" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "basePay"     FLOAT8,
  ADD COLUMN IF NOT EXISTS "category"    TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_emergency
  ON jobs ("isEmergency", "createdAt") WHERE "isEmergency" = true;

CREATE TABLE IF NOT EXISTS availability (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "dayOfWeek"      INT         NOT NULL CHECK ("dayOfWeek" BETWEEN 0 AND 6),
  "startTime"      TEXT        NOT NULL,
  "endTime"        TEXT        NOT NULL,
  "minWage"        FLOAT8      NOT NULL DEFAULT 0,
  categories       TEXT[]      NOT NULL DEFAULT '{}',
  "isOpenToOffers" BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", "dayOfWeek", "startTime")
);
CREATE INDEX IF NOT EXISTS idx_availability_user ON availability ("userId");
CREATE INDEX IF NOT EXISTS idx_availability_open ON availability ("isOpenToOffers") WHERE "isOpenToOffers" = true;

ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
