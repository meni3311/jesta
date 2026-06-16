import {
  Injectable, Logger, NotFoundException, ForbiddenException,
  ConflictException, BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// NOTE: like the rest of the codebase, queries touching columns/models from
// the 2026-06-14 migration go through `this.prisma.db` (untyped escape hatch)
// because the generated client types are stale until `npx prisma generate`.

/** Coins charged per filled slot, by tier. 1 coin = ₪1 internal value. */
export const COINS_PER_FILLED_JOB_FREE = 20;
export const COINS_PER_FILLED_JOB_PRO  = 18; // Pro discount
/** Both sides of a successful referral receive this many coins. */
export const REFERRAL_BONUS_COINS = 20;
/** Free-tier ceiling: jobs that may be created within one ISO week. */
export const FREE_WEEKLY_POST_LIMIT = 2;

type CoinTxnType =
  | 'PURCHASE' | 'JOB_CHARGE' | 'REFERRAL_BONUS' | 'ADJUSTMENT' | 'REFUND';

interface ApplyDeltaParams {
  type: CoinTxnType;
  amount: number;              // +credit / -debit, in coins
  jobId?: string | null;
  applicationId?: string | null;
  packageId?: string | null;
  stripePaymentIntentId?: string | null;
  description?: string | null;
}

/**
 * Start of the current ISO week (Monday 00:00) in Israel local time, returned
 * as a UTC instant. Used to count this week's job postings for the free-tier
 * limit. The UTC offset is derived dynamically so it stays correct across DST.
 */
export function israelStartOfIsoWeek(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    weekday: 'short', hourCycle: 'h23',
  } as Intl.DateTimeFormatOptions).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';

  const y = Number(get('year'));
  const mo = Number(get('month'));
  const d = Number(get('day'));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dow = Math.max(0, days.indexOf(get('weekday'))); // 0 = Sunday

  // Israel "wall clock" expressed as if it were UTC, to derive the live offset.
  const wallAsUtc = Date.UTC(
    y, mo - 1, d, Number(get('hour')), Number(get('minute')), Number(get('second')),
  );
  const offsetMs = wallAsUtc - now.getTime();

  // ISO week starts Monday: days since Monday = (dow + 6) % 7
  const daysSinceMonday = (dow + 6) % 7;
  const mondayMidnightWallUtc = Date.UTC(y, mo - 1, d) - daysSinceMonday * 86_400_000;
  return new Date(mondayMidnightWallUtc - offsetMs);
}

@Injectable()
export class CoinsService {
  private readonly logger = new Logger(CoinsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Catalog ────────────────────────────────────────────────────────────
  /** Active coin packages, cheapest first. Prices are in agorot. */
  async getPackages() {
    return this.prisma.db.coinPackage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getPackageById(id: string) {
    const pkg = await this.prisma.db.coinPackage.findUnique({ where: { id } });
    if (!pkg || !pkg.isActive) throw new NotFoundException('חבילת מטבעות לא נמצאה');
    return pkg;
  }

  // ── Wallet & ledger ──────────────────────────────────────────────────────
  /** Wallet summary for the employer dashboard. */
  async getWallet(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: {
        coinsBalance: true, isPro: true, proExpiresAt: true,
        subscriptionStatus: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      balance: user.coinsBalance,
      isPro: user.isPro,
      proExpiresAt: user.proExpiresAt,
      subscriptionStatus: user.subscriptionStatus,
    };
  }

  /** Recent ledger entries (most recent first). */
  async getTransactions(userId: string, take = 50) {
    return this.prisma.db.coinTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /**
   * Atomically apply a signed coin delta and append the matching ledger row.
   * The balance UPDATE and the ledger INSERT run in one transaction so they can
   * never diverge. The raw UPDATE is a single atomic statement (race-safe).
   *
   * Pass `tx` to enlist in an outer interactive transaction.
   */
  async applyDelta(userId: string, params: ApplyDeltaParams, tx?: any) {
    const exec = async (db: any) => {
      const rows: Array<{ coinsBalance: number }> = await db.$queryRaw`
        UPDATE users
           SET "coinsBalance" = "coinsBalance" + ${params.amount}
         WHERE id = ${userId}::uuid
        RETURNING "coinsBalance"`;
      if (!rows || rows.length === 0) {
        throw new NotFoundException('Employer wallet not found');
      }
      const balanceAfter = Number(rows[0].coinsBalance);

      const transaction = await db.coinTransaction.create({
        data: {
          userId,
          type: params.type,
          amount: params.amount,
          balanceAfter,
          jobId: params.jobId ?? null,
          applicationId: params.applicationId ?? null,
          packageId: params.packageId ?? null,
          stripePaymentIntentId: params.stripePaymentIntentId ?? null,
          description: params.description ?? null,
        },
      });
      return { balanceAfter, transaction };
    };

    if (tx) return exec(tx);
    return this.prisma.db.$transaction((t: any) => exec(t));
  }

  // ── Purchases (called by the Stripe webhook) ─────────────────────────────
  /**
   * Credit a completed coin purchase. Idempotent: the unique
   * stripePaymentIntentId guarantees a retried webhook never double-credits.
   */
  async creditPurchase(params: {
    userId: string;
    coins: number;
    packageId: string | null;
    stripePaymentIntentId: string;
    description?: string;
  }) {
    const existing = await this.prisma.db.coinTransaction.findUnique({
      where: { stripePaymentIntentId: params.stripePaymentIntentId },
    });
    if (existing) {
      this.logger.log(
        `PaymentIntent ${params.stripePaymentIntentId} already credited — skipping`,
      );
      return { alreadyCredited: true, balanceAfter: existing.balanceAfter };
    }

    try {
      const { balanceAfter } = await this.applyDelta(params.userId, {
        type: 'PURCHASE',
        amount: params.coins,
        packageId: params.packageId,
        stripePaymentIntentId: params.stripePaymentIntentId,
        description: params.description ?? `רכישת ${params.coins} מטבעות`,
      });
      this.logger.log(
        `Credited ${params.coins} coins to ${params.userId} (PI ${params.stripePaymentIntentId})`,
      );
      return { alreadyCredited: false, balanceAfter };
    } catch (err: any) {
      // P2002 = unique violation → a concurrent webhook won the race. Safe.
      if (err?.code === 'P2002') {
        return { alreadyCredited: true, balanceAfter: null };
      }
      throw err;
    }
  }

  // ── Job-fill charging ────────────────────────────────────────────────────
  /**
   * Charge the employer for one filled slot when a worker confirms arrival.
   *
   * • Free tier: 20 coins · Pro: 18 coins (per slot).
   * • Idempotent — an application (slot) is billed at most once
   *   (guarded by the atomic `coinCharged` flip).
   * • Increments the job's filledSlots; when the last required slot is filled
   *   the job is marked filled + inactive.
   *
   * Never throws to the caller for "not chargeable" cases — it returns a result
   * object so the arrival-confirmation flow is never blocked.
   */
  async chargeForFilledSlot(applicationId: string) {
    const app = await this.prisma.db.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true, coinCharged: true,
        job: {
          select: {
            id: true, employerId: true, title: true,
            requiredWorkers: true, filledSlots: true, filledAt: true,
          },
        },
      },
    });
    if (!app || !app.job) return { charged: false, reason: 'NOT_FOUND' as const };
    if (app.coinCharged) return { charged: false, reason: 'ALREADY_CHARGED' as const };

    const employer = await this.prisma.db.user.findUnique({
      where: { id: app.job.employerId },
      select: { isPro: true },
    });
    const amount = employer?.isPro ? COINS_PER_FILLED_JOB_PRO : COINS_PER_FILLED_JOB_FREE;

    // Atomic claim: only the first caller flips coinCharged false → true.
    const claim = await this.prisma.db.application.updateMany({
      where: { id: applicationId, coinCharged: false },
      data: { coinCharged: true, coinChargedAt: new Date(), coinAmount: amount },
    });
    if (claim.count === 0) return { charged: false, reason: 'ALREADY_CHARGED' as const };

    try {
      const { balanceAfter } = await this.applyDelta(app.job.employerId, {
        type: 'JOB_CHARGE',
        amount: -amount,
        jobId: app.job.id,
        applicationId: app.id,
        description: `חיוב על איוש משבצת ב"${app.job.title}"`,
      });

      // Count the slot. Close the job when all required slots are filled.
      const job = await this.prisma.db.job.update({
        where: { id: app.job.id },
        data: { filledSlots: { increment: 1 } },
        select: { id: true, filledSlots: true, requiredWorkers: true, filledAt: true },
      });
      if (job.filledSlots >= job.requiredWorkers && !job.filledAt) {
        await this.prisma.db.job.update({
          where: { id: job.id },
          data: { filledAt: new Date(), isActive: false },
        });
      }

      return {
        charged: true, amount, balanceAfter,
        slotsFilled: job.filledSlots, requiredWorkers: job.requiredWorkers,
        jobFilled: job.filledSlots >= job.requiredWorkers,
      };
    } catch (err) {
      // Roll the claim back so the slot can be charged on a later retry.
      await this.prisma.db.application.updateMany({
        where: { id: applicationId },
        data: { coinCharged: false, coinChargedAt: null, coinAmount: null },
      });
      throw err;
    }
  }

  // ── Free-tier weekly posting limit ───────────────────────────────────────
  /** Throws 403 WEEKLY_LIMIT_REACHED if a free employer is at the cap. */
  async assertCanPostJob(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { isPro: true },
    });
    if (user?.isPro) return; // Pro = unlimited

    const weekStart = israelStartOfIsoWeek();
    const used = await this.prisma.db.job.count({
      where: { employerId: userId, createdAt: { gte: weekStart } },
    });
    if (used >= FREE_WEEKLY_POST_LIMIT) {
      throw new ForbiddenException({
        message:
          `הגעת למכסת ${FREE_WEEKLY_POST_LIMIT} הג׳סטות השבועית בתוכנית החינמית. ` +
          'שדרגו ל-Pro לפרסום ללא הגבלה',
        code: 'WEEKLY_LIMIT_REACHED',
        limit: FREE_WEEKLY_POST_LIMIT,
        used,
      });
    }
  }

  // ── Referrals ────────────────────────────────────────────────────────────
  private generateReferralCode(): string {
    return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  /** The employer's referral code (created lazily) + payout stats. */
  async getReferralInfo(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');

    let code = user.referralCode;
    if (!code) {
      code = this.generateReferralCode();
      await this.prisma.db.user.update({
        where: { id: userId },
        data: { referralCode: code },
      });
    }

    const referrals = await this.prisma.db.referral.findMany({
      where: { referrerId: userId },
    });
    const paid = referrals.filter((r: any) => r.paidOut);
    return {
      code,
      totalReferred: referrals.length,
      paidCount: paid.length,
      coinsEarned: paid.length * REFERRAL_BONUS_COINS,
    };
  }

  /**
   * Link the current employer to a referrer's code. Allowed only before they
   * post their first job, and only once.
   */
  async applyReferralCode(userId: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    const me = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { referredById: true, role: true, firstJobPostedAt: true },
    });
    if (!me) throw new NotFoundException('User not found');
    if (me.role !== 'EMPLOYER') {
      throw new ForbiddenException('קוד חבר זמין למעסיקים בלבד');
    }
    if (me.referredById) throw new ConflictException('כבר שויך קוד חבר לחשבון');
    if (me.firstJobPostedAt) {
      throw new ConflictException('לא ניתן להזין קוד חבר אחרי פרסום הג׳סטה הראשונה');
    }

    const referrer = await this.prisma.db.user.findFirst({
      where: { referralCode: code, role: 'EMPLOYER' },
      select: { id: true },
    });
    if (!referrer) throw new NotFoundException('קוד חבר לא תקין');
    if (referrer.id === userId) {
      throw new BadRequestException('אי אפשר להזמין את עצמך');
    }

    await this.prisma.db.$transaction([
      this.prisma.db.user.update({
        where: { id: userId },
        data: { referredById: referrer.id },
      }),
      this.prisma.db.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: userId,
          bonusCoins: REFERRAL_BONUS_COINS,
        },
      }),
    ]);
    return { ok: true };
  }

  /**
   * Called once the employer creates their FIRST job. Records the milestone
   * and, if they were referred, pays the 20-coin bonus to BOTH sides exactly
   * once. Safe to call on every job creation — it no-ops after the first.
   */
  async onJobPosted(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { firstJobPostedAt: true },
    });
    if (!user || user.firstJobPostedAt) return; // not the first job

    await this.prisma.db.user.update({
      where: { id: userId },
      data: { firstJobPostedAt: new Date() },
    });

    const referral = await this.prisma.db.referral.findUnique({
      where: { referredId: userId },
    });
    if (!referral || referral.paidOut) return;

    // Atomic claim so the bonus is paid only once even under concurrency.
    const claim = await this.prisma.db.referral.updateMany({
      where: { id: referral.id, paidOut: false },
      data: { paidOut: true, paidOutAt: new Date() },
    });
    if (claim.count === 0) return;

    await this.applyDelta(referral.referredId, {
      type: 'REFERRAL_BONUS',
      amount: referral.bonusCoins,
      description: 'בונוס הצטרפות עם קוד חבר',
    });
    await this.applyDelta(referral.referrerId, {
      type: 'REFERRAL_BONUS',
      amount: referral.bonusCoins,
      description: 'בונוס על חבר שהצטרף ופרסם ג׳סטה ראשונה',
    });
    this.logger.log(
      `Referral paid: ${referral.bonusCoins} coins each to referrer ${referral.referrerId} and referred ${referral.referredId}`,
    );
  }
}
