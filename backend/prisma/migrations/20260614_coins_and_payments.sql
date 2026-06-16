-- ============================================================
--  Jesta — Migration 2026-06-14: Virtual Currency (Coins) & Payments
--  Run this in: Supabase Dashboard → SQL Editor → New query
--  Safe to run multiple times (IF NOT EXISTS / DO $$ guards).
--  After running: cd backend && npx prisma generate
--
--  Money convention:
--    • 1 coin = ₪1 of internal value (NEVER shown to employers as ₪).
--    • Real-money amounts are stored in AGOROT (integer). 2500 = ₪25.00.
-- ============================================================

-- ── New enums ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "CoinTxnType" AS ENUM (
    'PURCHASE', 'JOB_CHARGE', 'REFERRAL_BONUS', 'ADJUSTMENT', 'REFUND'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM (
    'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'TRIALING', 'UNPAID'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── users: wallet, subscription, referral columns ────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "coinsBalance"         INT                  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "proExpiresAt"         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "stripeCustomerId"     TEXT,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionStatus"   "SubscriptionStatus",
  ADD COLUMN IF NOT EXISTS "referralCode"         TEXT,
  ADD COLUMN IF NOT EXISTS "referredById"         UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS "firstJobPostedAt"     TIMESTAMPTZ;

-- NOTE: balance may briefly go negative when a job is filled but the employer's
-- wallet is short — the worker flow must never be blocked by the employer's
-- balance. The shortfall is settled on their next top-up. We therefore do NOT
-- add a non-negative CHECK constraint.

CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_key
  ON users ("referralCode") WHERE "referralCode" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_key
  ON users ("stripeCustomerId") WHERE "stripeCustomerId" IS NOT NULL;

-- ── jobs: multi-worker filling + shared invite link ──────────────────────────

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS "filledSlots" INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "filledAt"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "inviteToken" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_invite_token_key
  ON jobs ("inviteToken") WHERE "inviteToken" IS NOT NULL;

-- ── applications: per-slot coin charge tracking ──────────────────────────────

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS "coinCharged"   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "coinChargedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "coinAmount"    INT;

-- ── coin_packages (catalog) ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coin_packages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  coins           INT         NOT NULL CHECK (coins > 0),
  "priceIls"      INT         NOT NULL CHECK ("priceIls" > 0),  -- agorot
  "stripePriceId" TEXT,
  "sortOrder"     INT         NOT NULL DEFAULT 0,
  "isActive"      BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the four packages (idempotent by name)
INSERT INTO coin_packages (name, coins, "priceIls", "sortOrder")
SELECT v.name, v.coins, v.price, v.ord
FROM (VALUES
  ('Starter',  25,  2500,  1),
  ('Standard', 60,  5000,  2),
  ('Pro Pack', 100, 8000,  3),
  ('Business', 250, 18000, 4)
) AS v(name, coins, price, ord)
WHERE NOT EXISTS (SELECT 1 FROM coin_packages cp WHERE cp.name = v.name);

-- ── coin_transactions (append-only ledger) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS coin_transactions (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"                UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                    "CoinTxnType" NOT NULL,
  amount                  INT           NOT NULL,   -- +credit / -debit
  "balanceAfter"          INT           NOT NULL,
  "jobId"                 UUID,
  "applicationId"         UUID,
  "packageId"             UUID          REFERENCES coin_packages(id),
  "stripePaymentIntentId" TEXT,
  description             TEXT,
  "createdAt"             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coin_txn_user_created ON coin_transactions ("userId", "createdAt");
-- One ledger row per Stripe PaymentIntent → webhook idempotency
CREATE UNIQUE INDEX IF NOT EXISTS coin_txn_pi_key
  ON coin_transactions ("stripePaymentIntentId") WHERE "stripePaymentIntentId" IS NOT NULL;

-- ── referrals ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referrals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "referrerId" UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "referredId" UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "bonusCoins" INT         NOT NULL DEFAULT 20,
  "paidOut"    BOOLEAN     NOT NULL DEFAULT false,
  "paidOutAt"  TIMESTAMPTZ,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("referredId")                 -- an employer can only be referred once
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals ("referrerId");

-- ── Backfill: give every existing employer a referral code ───────────────────
UPDATE users
SET "referralCode" = UPPER(SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE role = 'EMPLOYER' AND "referralCode" IS NULL;

-- ── RLS (API-only access model — same as all other Jesta tables) ─────────────

ALTER TABLE coin_packages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals         ENABLE ROW LEVEL SECURITY;
