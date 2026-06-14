import {
  Injectable, Logger, NotFoundException,
  OnModuleInit, OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type NotificationKind =
  // legacy values (old rows still carry them)
  | 'CONFIRM_SHIFT' | 'CONFIRM_SHIFT_URGENT' | 'JOB_REOPENED'
  | 'RATE_REQUEST' | 'DIRECT_OFFER' | 'OFFER_RESPONSE' | 'GENERAL'
  // System 3 — the full spec set
  | 'NEW_APPLICANT'        // employer: a teenager applied
  | 'APPLICATION_APPROVED' // teenager: approved by the employer
  | 'PRE_SHIFT_REMINDER'   // teenager: T-3h confirm-arrival prompt
  | 'SHIFT_CONFIRMED'      // employer: the teenager confirmed arrival
  | 'NO_SHOW_FALLBACK'     // pending applicants: spot reopened after a no-show
  | 'RATING_REQUEST'       // both sides after a completed gesta
  | 'EMERGENCY_GESTA';     // available teenagers: emergency job posted

export interface NotifyPayload {
  type:  NotificationKind;
  title: string;
  body?: string;
  jobId?: string;
  applicationId?: string;
  offerId?: string;
}

/**
 * Pre-shift confirmation timing:
 *   T-3h  → CONFIRM_SHIFT          ("אנא אשרו הגעה")
 *   +1h with no confirmation → CONFIRM_SHIFT_URGENT
 *
 * The sweep runs in-process every SWEEP_INTERVAL_MS (no new npm deps — the
 * registry is blocked in this environment, so @nestjs/schedule isn't used).
 *
 * PRODUCTION NOTE: for multi-instance deployments move this sweep to a
 * single scheduled runner — e.g. Supabase pg_cron calling a SQL function, or
 * a Supabase Edge Function on a 5-minute schedule hitting
 * POST /api/notifications/sweep (guard it). The query is idempotent
 * (preShiftNotifiedAt / urgentNotifiedAt markers), so duplicate runners only
 * waste work, they never double-notify.
 */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const CONFIRM_WINDOW_MS = 3 * 60 * 60 * 1000;  // 3h before start
const URGENT_AFTER_MS   = 60 * 60 * 1000;      // 1h after first prompt

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private supabase: SupabaseClient | null = null;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // Service-role client used ONLY to broadcast realtime events
    // (same pattern as ChatService / JobsService).
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      this.supabase = createClient(url, key);
    } else {
      this.logger.warn('SUPABASE_URL / SERVICE_ROLE_KEY missing — realtime notification broadcast disabled');
    }
  }

  onModuleInit() {
    this.sweepTimer = setInterval(() => {
      this.sweepPreShiftConfirmations().catch((err) =>
        this.logger.error(`pre-shift sweep failed: ${err.message}`),
      );
    }, SWEEP_INTERVAL_MS);
    // Also run shortly after boot so a restarted server catches up fast.
    setTimeout(() => {
      this.sweepPreShiftConfirmations().catch((err) =>
        this.logger.error(`pre-shift sweep failed: ${err.message}`),
      );
    }, 15_000);
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  // ── Core API ────────────────────────────────────────────────────────────────

  /**
   * Persist a notification and broadcast it to the user's private realtime
   * channel `user:{userId}` (event `notification`). Broadcast failure is
   * logged but never breaks the calling flow — the row is already persisted.
   */
  async notify(userId: string, payload: NotifyPayload) {
    const notification = await this.prisma.db.notification.create({
      data: { userId, ...payload },
    });

    if (this.supabase) {
      const channel = this.supabase.channel(`user:${userId}`);
      channel
        .send({ type: 'broadcast', event: 'notification', payload: { notification } })
        .catch((err: Error) => this.logger.warn(`notification broadcast failed: ${err.message}`))
        .finally(() => this.supabase!.removeChannel(channel));
    }

    return notification;
  }

  /** GET /notifications — latest 50 + unread count */
  async listMine(userId: string) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.db.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { items, unreadCount };
  }

  /** PATCH /notifications/:id/read */
  async markRead(userId: string, id: string) {
    const { count } = await this.prisma.db.notification.updateMany({
      where: { id, userId },           // userId guard — can't read others' rows
      data:  { isRead: true },
    });
    if (count === 0) throw new NotFoundException('Notification not found');
    return { ok: true };
  }

  /** PATCH /notifications/read-all */
  async markAllRead(userId: string) {
    await this.prisma.db.notification.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true },
    });
    return { ok: true };
  }

  /**
   * PATCH /notifications/read-types — auto-mark-as-read when the user visits
   * the screen a notification points to (e.g. opening "המשמרות שלי" clears
   * APPLICATION_APPROVED / PRE_SHIFT_REMINDER notifications).
   */
  async markReadByTypes(userId: string, types: NotificationKind[]) {
    if (!Array.isArray(types) || types.length === 0) return { ok: true, count: 0 };
    const { count } = await this.prisma.db.notification.updateMany({
      where: { userId, isRead: false, type: { in: types } },
      data:  { isRead: true },
    });
    return { ok: true, count };
  }

  // ── Pre-shift confirmation sweep ───────────────────────────────────────────

  /**
   * Idempotent sweep:
   *  1. APPROVED applications starting within 3h, not yet confirmed and not
   *     yet prompted → CONFIRM_SHIFT + stamp preShiftNotifiedAt.
   *  2. Prompted ≥1h ago, still unconfirmed, shift not started yet
   *     → CONFIRM_SHIFT_URGENT + stamp urgentNotifiedAt.
   */
  async sweepPreShiftConfirmations() {
    const now = new Date();

    // 1) First prompt — T-3h
    const due = await this.prisma.db.application.findMany({
      where: {
        status: 'APPROVED',
        confirmedAt: null,
        preShiftNotifiedAt: null,
        job: { startTime: { gt: now, lte: new Date(now.getTime() + CONFIRM_WINDOW_MS) } },
      },
      include: { job: { select: { id: true, title: true, startTime: true } } },
    });

    for (const app of due) {
      await this.notify(app.workerId, {
        type:  'PRE_SHIFT_REMINDER',
        title: 'אישור הגעה למשמרת',
        body:  `המשמרת "${app.job.title}" מתחילה בקרוב — אנא אשרו הגעה`,
        jobId: app.job.id,
        applicationId: app.id,
      });
      await this.prisma.db.application.update({
        where: { id: app.id },
        data:  { preShiftNotifiedAt: now },
      });
    }

    // 2) Urgent reminder — 1h after the first prompt, still unconfirmed
    const urgent = await this.prisma.db.application.findMany({
      where: {
        status: 'APPROVED',
        confirmedAt: null,
        urgentNotifiedAt: null,
        preShiftNotifiedAt: { lte: new Date(now.getTime() - URGENT_AFTER_MS) },
        job: { startTime: { gt: now } },
      },
      include: { job: { select: { id: true, title: true, startTime: true } } },
    });

    for (const app of urgent) {
      await this.notify(app.workerId, {
        type:  'CONFIRM_SHIFT_URGENT',
        title: 'דחוף: טרם אישרת הגעה!',
        body:  `המשמרת "${app.job.title}" מתחילה ממש בקרוב. אשרו הגעה עכשיו — אי-הגעה פוגעת בציון שלכם`,
        jobId: app.job.id,
        applicationId: app.id,
      });
      await this.prisma.db.application.update({
        where: { id: app.id },
        data:  { urgentNotifiedAt: now },
      });
    }

    if (due.length || urgent.length) {
      this.logger.log(`pre-shift sweep: ${due.length} prompts, ${urgent.length} urgent reminders`);
    }
  }
}
