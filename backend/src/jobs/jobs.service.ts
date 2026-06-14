import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
  BadRequestException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ScoreService } from '../score/score.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateJobDto }  from './dto/create-job.dto';
import { QueryJobsDto }  from './dto/query-jobs.dto';
import { UpdateJobDto }  from './dto/update-job.dto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// NOTE: queries touching models/columns from the 2026-06-11 migration go
// through `this.prisma.db` (see PrismaService.db) because the generated
// client types in node_modules are stale in this environment. Runtime
// behavior is identical; full typing returns after `npx prisma generate`.

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Public worker card: rating + count + Jesta Score + reliability signals */
const WORKER_SELECT = {
  id: true, fullName: true, avatarUrl: true,
  rating: true, ratingCount: true, jestaScore: true,
  completedJobs: true, warningFlag: true, noShowCount: true,
} as const;

const EMPLOYER_SELECT = {
  id: true, fullName: true, avatarUrl: true,
  rating: true, ratingCount: true, jestaScore: true,
} as const;

/** How many APPROVED time-overlapping jobs a worker may stack (System 2) */
const MAX_OVERLAPPING_APPROVED = 3;

/** Emergency Gesta: must start within this window … */
const EMERGENCY_WINDOW_MS = 3 * 60 * 60 * 1000;
/** … and the wage is automatically raised by this factor */
const EMERGENCY_BONUS_FACTOR = 1.2;
/** Cap on how many workers a single emergency fanout notifies */
const EMERGENCY_FANOUT_LIMIT = 200;

/**
 * Lifecycle status shown on the employer dashboard (computed, not stored —
 * derived from isActive / cancelledAt / application states / shift times).
 */
export type JobUiStatus =
  | 'OPEN' | 'EMERGENCY' | 'APPROVED' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

function computeUiStatus(job: {
  isActive: boolean; isEmergency: boolean;
  cancelledAt: Date | null; endTime: Date;
  applications?: { status: string }[];
}): JobUiStatus {
  const apps = job.applications ?? [];
  if (job.cancelledAt) return 'CANCELLED';
  if (apps.some((a) => a.status === 'COMPLETED')) return 'COMPLETED';
  if (apps.some((a) => a.status === 'APPROVED'))  return 'APPROVED';
  if (new Date(job.endTime) < new Date())         return 'EXPIRED';
  if (job.isEmergency && job.isActive)            return 'EMERGENCY';
  return 'OPEN';
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private supabase: SupabaseClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly score: ScoreService,
    private readonly notifications: NotificationsService,
  ) {
    // Service-role client used ONLY to broadcast realtime events
    // (same pattern as ChatService). The employer dashboard subscribes
    // to channel `employer:{employerId}` with the anon key.
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      this.supabase = createClient(url, key);
    } else {
      this.logger.warn('SUPABASE_URL / SERVICE_ROLE_KEY missing — realtime applicant broadcast disabled');
    }
  }

  /** Fire-and-forget broadcast to the employer's private realtime channel. */
  private async broadcastToEmployer(employerId: string, event: string, payload: unknown) {
    if (!this.supabase) return;
    const channel = this.supabase.channel(`employer:${employerId}`);
    try {
      await channel.send({ type: 'broadcast', event, payload });
    } finally {
      await this.supabase.removeChannel(channel);
    }
  }

  /** Throws 403 if the worker is suspended or pending manual review. */
  private assertWorkerInGoodStanding(worker: {
    suspendedUntil: Date | null; reviewFlag: boolean;
  }) {
    if (worker.reviewFlag) {
      throw new ForbiddenException(
        'החשבון שלך הוקפא לבדיקה עקב אי-הגעות חוזרות. פנו לתמיכה לשחרור החשבון',
      );
    }
    if (worker.suspendedUntil && new Date(worker.suspendedUntil) > new Date()) {
      const until = new Date(worker.suspendedUntil).toLocaleString('he-IL', {
        day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      throw new ForbiddenException(`החשבון מושעה עקב אי-הגעה. ההשעיה מסתיימת ב-${until}`);
    }
  }

  /**
   * Application overlap limit (System 2): a worker may not register to a job
   * whose time window overlaps MAX_OVERLAPPING_APPROVED (or more) of their
   * already-APPROVED jobs. Returns the conflicting jobs for a clear message.
   */
  private async findApprovedOverlaps(workerId: string, startTime: Date, endTime: Date) {
    const overlapping = await this.prisma.db.application.findMany({
      where: {
        workerId,
        status: 'APPROVED',
        job: {
          startTime: { lt: endTime },
          endTime:   { gt: startTime },
        },
      },
      include: {
        job: { select: { id: true, title: true, startTime: true, endTime: true } },
      },
    });
    return overlapping.map((a: any) => a.job);
  }

  // GET /jobs
  // Feed priority (System 1): emergency jobs first (newest first), then
  // regular jobs — by distance when the caller sent coordinates, otherwise
  // by recency.
  async findAll(query: QueryJobsDto) {
    const { lat, lng, radius = 10, minPay } = query;
    let jobs = await this.prisma.db.job.findMany({
      where: {
        isActive: true,
        ...(minPay !== undefined && { pay: { gte: minPay } }),
      },
      include: {
        employer: { select: EMPLOYER_SELECT },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const hasCoords = lat !== undefined && lng !== undefined;
    if (hasCoords) {
      jobs = jobs.filter((j: any) => haversineKm(lat!, lng!, j.lat, j.lng) <= radius);
    }

    const emergency = jobs.filter((j: any) => j.isEmergency);   // already newest-first
    const regular   = jobs.filter((j: any) => !j.isEmergency);
    if (hasCoords) {
      regular.sort((a: any, b: any) =>
        haversineKm(lat!, lng!, a.lat, a.lng) - haversineKm(lat!, lng!, b.lat, b.lng));
    }
    return [...emergency, ...regular];
  }

  // GET /jobs/employer
  // Pro employers get full applicant cards; free employers get PENDING
  // applicants redacted to a count-only shape (System 3 gating, enforced
  // server-side so the API can't be inspected to bypass the paywall).
  async getEmployerJobs(employerId: string) {
    const employer = await this.prisma.db.user.findUnique({
      where: { id: employerId },
      select: { isPro: true },
    });

    const jobs = await this.prisma.db.job.findMany({
      where: { employerId },
      include: {
        _count: { select: { applications: true } },
        applications: {
          where: { status: { in: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'NO_SHOW'] } },
          include: { worker: { select: WORKER_SELECT } },
          orderBy: { createdAt: 'asc' },
        },
        // Ratings on this job — lets COMPLETED cards show the rating received
        ratings: { select: { score: true, comment: true, toUserId: true, fromUserId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Lifecycle status badge for the dashboard (System 4)
    const withStatus = jobs.map((job: any) => ({ ...job, uiStatus: computeUiStatus(job) }));

    if (employer?.isPro) return withStatus;

    // Free tier: hide who is waiting — only that someone is.
    return withStatus.map((job: any) => ({
      ...job,
      applications: job.applications.map((app: any) =>
        app.status === 'PENDING'
          ? { id: app.id, status: app.status, createdAt: app.createdAt, worker: null, redacted: true }
          : app,
      ),
    }));
  }

  // GET /jobs/employer/stats — real aggregates for the dashboard stats bar
  // (System 4): published, completed, average rating received, total paid out.
  async getEmployerStats(employerId: string) {
    const [totalPublished, me, completedApps] = await Promise.all([
      this.prisma.db.job.count({ where: { employerId } }),
      this.prisma.db.user.findUnique({
        where: { id: employerId },
        select: { rating: true, ratingCount: true },
      }),
      this.prisma.db.application.findMany({
        where: { status: 'COMPLETED', job: { employerId } },
        include: { job: { select: { pay: true, startTime: true, endTime: true } } },
      }),
    ]);

    // Paid out = Σ (hourly pay × shift hours) over completed gestas
    const totalPaid = completedApps.reduce((sum: number, a: any) => {
      const hours = Math.max(
        0,
        (new Date(a.job.endTime).getTime() - new Date(a.job.startTime).getTime()) / 36e5,
      );
      return sum + a.job.pay * hours;
    }, 0);

    return {
      totalPublished,
      totalCompleted: completedApps.length,
      avgRating:      me?.rating ?? 0,
      ratingCount:    me?.ratingCount ?? 0,
      totalPaid:      Math.round(totalPaid),
    };
  }

  // GET /jobs/applications/me — the worker's own applications ("my shifts")
  async getMyApplications(workerId: string) {
    return this.prisma.db.application.findMany({
      where: { workerId },
      include: {
        job: {
          include: {
            employer: { select: EMPLOYER_SELECT },
          },
        },
        chat: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // POST /jobs
  async create(employerId: string, role: string, dto: CreateJobDto) {
    if (role !== 'EMPLOYER') {
      throw new ForbiddenException('Only employers can post jobs');
    }

    // Insurance mode ("ג'סטה מבוטחת") is a Pro feature — enforced server-side.
    if (dto.isInsured) {
      const employer = await this.prisma.db.user.findUnique({
        where: { id: employerId },
        select: { isPro: true },
      });
      if (!employer?.isPro) {
        throw new ForbiddenException('ג׳סטה מבוטחת זמינה למנויי פרו בלבד');
      }
    }

    const startTime = new Date(dto.startTime);
    const endTime   = new Date(dto.endTime);

    // ── Emergency Gesta (System 1) ──
    // Must start within 3 hours (and not in the past); the wage is raised by
    // 20% automatically. basePay keeps the original so both sides see the
    // breakdown (original + bonus).
    let pay     = dto.pay;
    let basePay: number | null = null;
    if (dto.isEmergency) {
      const untilStart = startTime.getTime() - Date.now();
      if (untilStart > EMERGENCY_WINDOW_MS) {
        throw new BadRequestException(
          'ג׳סטת חירום חייבת להתחיל תוך 3 שעות מרגע הפרסום',
        );
      }
      if (endTime.getTime() < Date.now()) {
        throw new BadRequestException('ג׳סטת חירום לא יכולה להסתיים בעבר');
      }
      basePay = dto.pay;
      pay     = Math.round(dto.pay * EMERGENCY_BONUS_FACTOR);
    }

    const job = await this.prisma.db.job.create({
      data: {
        ...dto,
        pay,
        basePay,
        startTime,
        endTime,
        perks:       dto.perks ?? [],
        isInsured:   dto.isInsured ?? false,
        isEmergency: dto.isEmergency ?? false,
        category:    dto.category ?? null,
        employerId,
      },
      include: {
        employer: { select: EMPLOYER_SELECT },
        _count:   { select: { applications: true } },
      },
    });

    // Fanout AFTER the job is persisted — a notification failure must never
    // lose the job itself.
    if (job.isEmergency) {
      this.notifyEmergencyCandidates(job).catch((err) =>
        this.logger.warn(`emergency fanout failed for job ${job.id}: ${err.message}`),
      );
    }

    return job;
  }

  /**
   * EMERGENCY_GESTA fanout (System 1): notify available teenagers who have no
   * approved job overlapping this shift and are in good standing.
   *
   * NOTE on "within radius": workers have no stored home location yet (only
   * jobs carry lat/lng), so the radius filter cannot run server-side. Until a
   * worker location field exists we notify all eligible workers, capped at
   * EMERGENCY_FANOUT_LIMIT, most reliable first.
   */
  private async notifyEmergencyCandidates(job: {
    id: string; title: string; pay: number; basePay: number | null;
    startTime: Date; endTime: Date; employerId: string;
  }) {
    const now = new Date();

    // Workers already busy at that time
    const busy = await this.prisma.db.application.findMany({
      where: {
        status: 'APPROVED',
        job: { startTime: { lt: job.endTime }, endTime: { gt: job.startTime } },
      },
      select: { workerId: true },
    });
    const busyIds: string[] = [...new Set(busy.map((b: any) => b.workerId as string))];

    const candidates = await this.prisma.db.user.findMany({
      where: {
        role: 'WORKER',
        reviewFlag: false,
        OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: now } }],
        ...(busyIds.length && { id: { notIn: busyIds } }),
      },
      select:  { id: true },
      orderBy: { jestaScore: 'desc' },
      take:    EMERGENCY_FANOUT_LIMIT,
    });

    const startStr = new Date(job.startTime).toLocaleTimeString('he-IL', {
      hour: '2-digit', minute: '2-digit',
    });
    await Promise.allSettled(
      candidates.map((c: any) =>
        this.notifications.notify(c.id, {
          type:  'EMERGENCY_GESTA',
          title: 'ג׳סטת חירום באזורך — שכר מוגדל!',
          body:  `"${job.title}" מתחילה ב-${startStr} · ₪${job.pay}/ש׳ (כולל בונוס חירום של 20%). הזריזים זוכים!`,
          jobId: job.id,
        }),
      ),
    );
    this.logger.log(`emergency fanout: notified ${candidates.length} workers for job ${job.id}`);
  }

  // GET /jobs/:id
  async findOne(id: string) {
    const job = await this.prisma.db.job.findUnique({
      where: { id },
      include: {
        employer:     { select: EMPLOYER_SELECT },
        applications: { include: { worker: { select: WORKER_SELECT } } },
      },
    });
    if (!job) throw new NotFoundException('Job ' + id + ' not found');
    return job;
  }

  // PATCH /jobs/:id — employer edits their own job
  async update(jobId: string, employerId: string, dto: UpdateJobDto) {
    const job = await this.prisma.db.job.findUnique({
      where: { id: jobId },
      include: {
        applications: { where: { status: 'APPROVED' }, select: { id: true } },
      },
    });
    if (!job) throw new NotFoundException('Job ' + jobId + ' not found');
    if (job.employerId !== employerId) throw new ForbiddenException('Not your job');

    // Lock: once a worker has been APPROVED the shift terms are a commitment —
    // changing pay/hours after the fact would pull the rug from under them.
    if (job.applications.length > 0) {
      throw new ConflictException(
        'This Jesta is locked: a worker has already been approved, so its terms can no longer be edited',
      );
    }

    const { startTime, endTime, ...rest } = dto;
    return this.prisma.db.job.update({
      where: { id: jobId },
      data: {
        ...rest,
        ...(startTime !== undefined && { startTime: new Date(startTime) }),
        ...(endTime   !== undefined && { endTime:   new Date(endTime) }),
      },
      include: {
        employer: { select: EMPLOYER_SELECT },
        _count:   { select: { applications: true } },
        applications: {
          where: { status: { in: ['PENDING', 'APPROVED', 'REJECTED'] } },
          include: { worker: { select: WORKER_SELECT } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  // POST /jobs/:id/apply
  async apply(jobId: string, workerId: string, role: string) {
    if (role !== 'WORKER') {
      throw new ForbiddenException('Only workers can apply to jobs');
    }
    const job = await this.prisma.db.job.findUnique({ where: { id: jobId } });
    if (!job)          throw new NotFoundException('Job ' + jobId + ' not found');
    if (!job.isActive) throw new ConflictException('This job is no longer available');

    // Reliability gate: suspended / under-review workers cannot apply.
    const worker = await this.prisma.db.user.findUnique({
      where: { id: workerId },
      select: { suspendedUntil: true, reviewFlag: true },
    });
    if (!worker) throw new NotFoundException('Worker not found');
    this.assertWorkerInGoodStanding(worker);

    const existing = await this.prisma.db.application.findUnique({
      where: { jobId_workerId: { jobId, workerId } },
    });
    if (existing) throw new ConflictException('You have already applied to this job');

    // Overlap limit: block when the worker already has 3+ APPROVED jobs
    // overlapping this job's time window. The conflicting jobs are returned
    // so the UI can show exactly which shifts collide.
    const conflicts = await this.findApprovedOverlaps(workerId, job.startTime, job.endTime);
    if (conflicts.length >= MAX_OVERLAPPING_APPROVED) {
      throw new ConflictException({
        message: `לא ניתן להירשם — יש לך כבר ${conflicts.length} משמרות מאושרות שחופפות בזמן לג׳סטה הזו`,
        code: 'OVERLAP_LIMIT',
        conflicts,
      });
    }

    const application = await this.prisma.db.application.create({
      data: { jobId, workerId },
      include: {
        job:    { select: { id: true, title: true } },
        worker: { select: WORKER_SELECT },
      },
    });

    // Realtime: notify the employer's dashboard instantly. Fire-and-forget —
    // a broadcast failure must never lose the application (already persisted).
    this.broadcastToEmployer(job.employerId, 'new-application', { application })
      .catch((err) =>
        this.logger.warn(`Realtime broadcast failed for employer ${job.employerId}: ${err.message}`),
      );

    // Persisted notification (System 3): NEW_APPLICANT → employer
    this.notifications
      .notify(job.employerId, {
        type:  'NEW_APPLICANT',
        title: 'מועמד חדש לג׳סטה שלך!',
        body:  `${application.worker?.fullName ?? 'ג׳סטר'} נרשם ל"${job.title}"`,
        jobId, applicationId: application.id,
      })
      .catch(() => { /* fire-and-forget */ });

    return application;
  }

  // PATCH /jobs/:jobId/applications/:appId/approve
  async approveApplication(jobId: string, appId: string, employerId: string) {
    const job = await this.prisma.db.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job ' + jobId + ' not found');
    if (job.employerId !== employerId) throw new ForbiddenException('Not your job');

    const application = await this.prisma.db.application.findUnique({
      where: { id: appId },
      include: { worker: { select: WORKER_SELECT } },
    });
    if (!application || application.jobId !== jobId) {
      throw new NotFoundException('Application ' + appId + ' not found on job ' + jobId);
    }
    if (application.status !== 'PENDING') {
      throw new ConflictException('Application is already ' + application.status);
    }

    const [updatedApp, , , chat] = await this.prisma.db.$transaction([
      this.prisma.db.application.update({
        where: { id: appId },
        // approvedAt anchors the response-speed component of the Jesta Score
        data:  { status: 'APPROVED', approvedAt: new Date() },
        include: {
          worker: { select: WORKER_SELECT },
          job:    { select: { id: true, title: true } },
        },
      }),
      this.prisma.db.job.update({
        where: { id: jobId },
        data:  { isActive: false },
      }),
      // Position filled — reject all other pending applications on this job
      // so workers aren't left waiting forever. autoRejected=true keeps them
      // eligible for the no-show fallback re-invite.
      this.prisma.db.application.updateMany({
        where: { jobId, id: { not: appId }, status: 'PENDING' },
        data:  { status: 'REJECTED', autoRejected: true },
      }),
      this.prisma.db.chat.create({
        data: { applicationId: appId, employerId, workerId: application.workerId },
        include: {
          employer: { select: { id: true, fullName: true, avatarUrl: true } },
          worker:   { select: { id: true, fullName: true, avatarUrl: true } },
        },
      }),
    ]);

    this.notifications
      .notify(application.workerId, {
        type:  'APPLICATION_APPROVED',
        title: 'אושרת לג׳סטה! ⚡',
        body:  `המעסיק אישר אותך ל"${job.title}". זכרו לאשר הגעה לפני המשמרת`,
        jobId, applicationId: appId,
      })
      .catch(() => { /* fire-and-forget */ });

    return { application: updatedApp, chat };
  }

  // PATCH /jobs/:jobId/applications/:appId/reject
  async rejectApplication(jobId: string, appId: string, employerId: string) {
    const job = await this.prisma.db.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job ' + jobId + ' not found');
    if (job.employerId !== employerId) throw new ForbiddenException('Not your job');

    const application = await this.prisma.db.application.findUnique({
      where: { id: appId },
    });
    if (!application || application.jobId !== jobId) {
      throw new NotFoundException('Application ' + appId + ' not found');
    }

    return this.prisma.db.application.update({
      where: { id: appId },
      // Explicit employer decision — NOT eligible for fallback re-invites
      data:  { status: 'REJECTED', autoRejected: false },
      include: { worker: { select: WORKER_SELECT } },
    });
  }

  // POST /jobs/:jobId/approve-first — free-tier blind approval (System 3):
  // free employers can't see applicant cards, so they approve the first
  // (oldest) pending applicant with one tap.
  async approveFirst(jobId: string, employerId: string) {
    const job = await this.prisma.db.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job ' + jobId + ' not found');
    if (job.employerId !== employerId) throw new ForbiddenException('Not your job');

    const first = await this.prisma.db.application.findFirst({
      where:   { jobId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    if (!first) throw new NotFoundException('אין מועמדים ממתינים לג׳סטה הזו');

    return this.approveApplication(jobId, first.id, employerId);
  }

  // POST /jobs/applications/:appId/confirm — "אישור הגעה" (System 2)
  // Worker confirms arrival before the shift. Minutes-to-confirm feed the
  // response-speed component of the Jesta Score.
  async confirmArrival(appId: string, workerId: string) {
    const app = await this.prisma.db.application.findUnique({
      where: { id: appId },
      include: { job: { select: { id: true, title: true, startTime: true, employerId: true } } },
    });
    if (!app)                       throw new NotFoundException('Application not found');
    if (app.workerId !== workerId)  throw new ForbiddenException('Not your application');
    if (app.status !== 'APPROVED')  throw new ConflictException('רק משמרות מאושרות ניתן לאשר');
    if (app.confirmedAt)            throw new ConflictException('כבר אישרת הגעה למשמרת הזו');

    const now = new Date();
    // Response time is measured from the confirmation prompt if one was sent,
    // otherwise from the approval itself.
    const basis = app.preShiftNotifiedAt ?? app.approvedAt ?? app.createdAt;
    const minutes = Math.max(0, (now.getTime() - new Date(basis).getTime()) / 60_000);

    const [updated] = await this.prisma.db.$transaction([
      this.prisma.db.application.update({
        where: { id: appId },
        data:  { confirmedAt: now },
        include: { job: { select: { id: true, title: true, startTime: true } } },
      }),
      this.prisma.db.user.update({
        where: { id: workerId },
        data: {
          responseCount:    { increment: 1 },
          responseTotalMin: { increment: Math.round(minutes * 10) / 10 },
        },
      }),
    ]);

    await this.score.recalculate(workerId);

    this.broadcastToEmployer(app.job.employerId, 'application-update', {
      applicationId: appId, kind: 'confirmed',
    }).catch(() => { /* fire-and-forget */ });

    // SHIFT_CONFIRMED → employer (System 3)
    this.notifications
      .notify(app.job.employerId, {
        type:  'SHIFT_CONFIRMED',
        title: 'העובד אישר הגעה',
        body:  `הג׳סטר אישר הגעה ל"${app.job.title}"`,
        jobId: app.job.id, applicationId: appId,
      })
      .catch(() => { /* fire-and-forget */ });

    return updated;
  }

  // PATCH /jobs/:jobId/applications/:appId/complete — gesta done (System 1)
  // Marks the shift completed, updates the worker's counters + Jesta Score and
  // triggers the mutual rating prompts for both sides.
  async completeApplication(jobId: string, appId: string, employerId: string) {
    const job = await this.prisma.db.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job ' + jobId + ' not found');
    if (job.employerId !== employerId) throw new ForbiddenException('Not your job');

    const app = await this.prisma.db.application.findUnique({ where: { id: appId } });
    if (!app || app.jobId !== jobId) throw new NotFoundException('Application not found');
    if (app.status !== 'APPROVED') {
      throw new ConflictException('רק משמרת מאושרת אפשר לסמן כהושלמה');
    }

    const now = new Date();
    const [updated] = await this.prisma.db.$transaction([
      this.prisma.db.application.update({
        where: { id: appId },
        data:  { status: 'COMPLETED', completedAt: now },
        include: { worker: { select: WORKER_SELECT } },
      }),
      this.prisma.db.user.update({
        where: { id: app.workerId },
        data: {
          completedJobs: { increment: 1 },
          showUpCount:   { increment: 1 },
        },
      }),
    ]);

    await this.score.recalculate(app.workerId);

    // Mutual rating prompts (System 1, flow step 1)
    const notifyBoth = [
      this.notifications.notify(employerId, {
        type:  'RATING_REQUEST',
        title: 'איך היה העובד?',
        body:  `הג׳סטה "${job.title}" הושלמה — דרגו את העובד`,
        jobId, applicationId: appId,
      }),
      this.notifications.notify(app.workerId, {
        type:  'RATING_REQUEST',
        title: 'איך היה המעסיק?',
        body:  `סיימת את "${job.title}" — דרגו את המעסיק`,
        jobId, applicationId: appId,
      }),
    ];
    Promise.allSettled(notifyBoth).catch(() => { /* unreachable */ });

    return updated;
  }

  // PATCH /jobs/:jobId/applications/:appId/no-show (System 2)
  // Strike escalation: 1st → warning flag · 2nd → 48h suspension ·
  // 3rd → permanent review flag (manual unblock). Then the fallback flow
  // re-invites eligible previous applicants — first to claim is approved.
  async markNoShow(jobId: string, appId: string, employerId: string) {
    const job = await this.prisma.db.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job ' + jobId + ' not found');
    if (job.employerId !== employerId) throw new ForbiddenException('Not your job');

    const app = await this.prisma.db.application.findUnique({ where: { id: appId } });
    if (!app || app.jobId !== jobId) throw new NotFoundException('Application not found');
    if (app.status !== 'APPROVED') {
      throw new ConflictException('רק עובד מאושר אפשר לסמן כלא הגיע');
    }
    if (new Date() < new Date(job.startTime)) {
      throw new ConflictException('אפשר לסמן אי-הגעה רק אחרי שעת תחילת המשמרת');
    }

    const now = new Date();

    // 1) Mark the no-show + bump the strike counter
    const [, worker] = await this.prisma.db.$transaction([
      this.prisma.db.application.update({
        where: { id: appId },
        data:  { status: 'NO_SHOW', noShowAt: now },
      }),
      this.prisma.db.user.update({
        where: { id: app.workerId },
        data:  { noShowCount: { increment: 1 } },
        select: { id: true, noShowCount: true },
      }),
    ]);

    // 2) Escalate by total offenses
    const strikes = worker.noShowCount;
    const escalation: Record<string, unknown> = { warningFlag: true };
    let strikeMsg = 'קיבלת אזהרה על אי-הגעה למשמרת. אי-הגעה נוספת תוביל להשעיה';
    if (strikes === 2) {
      escalation.suspendedUntil = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      strikeMsg = 'זו אי-ההגעה השנייה — החשבון הושעה ל-48 שעות';
    } else if (strikes >= 3) {
      escalation.reviewFlag = true;
      strikeMsg = 'זו אי-ההגעה השלישית — החשבון הוקפא לבדיקה ידנית. פנו לתמיכה';
    }
    await this.prisma.db.user.update({ where: { id: app.workerId }, data: escalation });

    // 3) Attendance dropped → recalculate the Jesta Score
    await this.score.recalculate(app.workerId);

    this.notifications
      .notify(app.workerId, {
        type: 'GENERAL',
        title: 'סומנת כלא הגעת למשמרת',
        body: `"${job.title}": ${strikeMsg}`,
        jobId, applicationId: appId,
      })
      .catch(() => { /* fire-and-forget */ });

    // 4) Fallback flow — reopen the job and re-invite eligible applicants:
    //    PENDING ones plus those auto-rejected when the spot was filled
    //    (never the manually rejected), skipping anyone suspended or with an
    //    overlapping approved job at that time. First to claim wins.
    await this.prisma.db.job.update({ where: { id: jobId }, data: { isActive: true } });

    const candidates = await this.prisma.db.application.findMany({
      where: {
        jobId,
        id: { not: appId },
        OR: [
          { status: 'PENDING' },
          { status: 'REJECTED', autoRejected: true },
        ],
      },
      include: {
        worker: { select: { id: true, suspendedUntil: true, reviewFlag: true } },
      },
    });

    // Who is busy at this job's time window?
    const candidateWorkerIds = candidates.map((c: any) => c.workerId);
    const busy = candidateWorkerIds.length
      ? await this.prisma.db.application.findMany({
          where: {
            workerId: { in: candidateWorkerIds },
            status: 'APPROVED',
            job: { startTime: { lt: job.endTime }, endTime: { gt: job.startTime } },
          },
          select: { workerId: true },
        })
      : [];
    const busyIds = new Set(busy.map((b: any) => b.workerId));

    const eligible = candidates.filter((c: any) =>
      !busyIds.has(c.workerId) &&
      !c.worker.reviewFlag &&
      (!c.worker.suspendedUntil || new Date(c.worker.suspendedUntil) <= now),
    );

    if (eligible.length > 0) {
      await this.prisma.db.application.updateMany({
        where: { id: { in: eligible.map((c: any) => c.id) } },
        data:  { status: 'PENDING', autoRejected: false },
      });
      for (const c of eligible) {
        this.notifications
          .notify(c.workerId, {
            type:  'NO_SHOW_FALLBACK',
            title: 'המשרה התפנתה — עדיין מעוניין?',
            body:  `"${job.title}" שוב זמינה. הראשון שמאשר — מקבל את המשמרת!`,
            jobId, applicationId: c.id,
          })
          .catch(() => { /* fire-and-forget */ });
      }
    }

    // 5) Insurance mode (System 3 scaffold): insured jobs flag the employer
    //    for priority support. Actual insurance logic TBD.
    if (job.isInsured) {
      const employer = await this.prisma.db.user.findUnique({
        where: { id: employerId },
        select: { proFeatures: true },
      });
      await this.prisma.db.user.update({
        where: { id: employerId },
        data:  { proFeatures: { ...(employer?.proFeatures ?? {}), prioritySupport: true } },
      });
      this.notifications
        .notify(employerId, {
          type: 'GENERAL',
          title: 'ביטוח הג׳סטה הופעל 🛡️',
          body: `העובד לא הגיע ל"${job.title}". המערכת מחפשת מחליף אוטומטית וקיבלת עדיפות בתמיכה`,
          jobId,
        })
        .catch(() => { /* fire-and-forget */ });
    }

    return { ok: true, strikes, reinvited: eligible.length };
  }

  // POST /jobs/applications/:appId/claim (System 2 fallback, step 3)
  // Worker answers a JOB_REOPENED notification. First to claim is
  // auto-approved — guarded atomically so two claimers can't both win.
  async claimReopened(appId: string, workerId: string) {
    const app = await this.prisma.db.application.findUnique({
      where: { id: appId },
      include: { job: true },
    });
    if (!app)                      throw new NotFoundException('Application not found');
    if (app.workerId !== workerId) throw new ForbiddenException('Not your application');
    if (app.status !== 'PENDING') {
      throw new ConflictException('ההזמנה כבר לא בתוקף');
    }

    const worker = await this.prisma.db.user.findUnique({
      where: { id: workerId },
      select: { suspendedUntil: true, reviewFlag: true },
    });
    if (!worker) throw new NotFoundException('Worker not found');
    this.assertWorkerInGoodStanding(worker);

    // Atomic first-wins guard: only approve while still PENDING and while the
    // job has no APPROVED application.
    const now = new Date();
    const { count } = await this.prisma.db.application.updateMany({
      where: {
        id: appId,
        status: 'PENDING',
        job: { applications: { none: { status: 'APPROVED' } } },
      },
      data: { status: 'APPROVED', approvedAt: now, autoRejected: false },
    });
    if (count === 0) {
      throw new ConflictException('מישהו אחר כבר תפס את המשמרת הזו');
    }

    // Close the job + auto-reject the other re-invited applicants
    await this.prisma.db.$transaction([
      this.prisma.db.job.update({ where: { id: app.jobId }, data: { isActive: false } }),
      this.prisma.db.application.updateMany({
        where: { jobId: app.jobId, id: { not: appId }, status: 'PENDING' },
        data:  { status: 'REJECTED', autoRejected: true },
      }),
    ]);

    // Chat: an application approved for the first time has no chat yet.
    let chat = await this.prisma.db.chat.findUnique({ where: { applicationId: appId } });
    if (!chat) {
      chat = await this.prisma.db.chat.create({
        data: { applicationId: appId, employerId: app.job.employerId, workerId },
        include: {
          employer: { select: { id: true, fullName: true, avatarUrl: true } },
          worker:   { select: { id: true, fullName: true, avatarUrl: true } },
        },
      });
    }

    const updated = await this.prisma.db.application.findUnique({
      where: { id: appId },
      include: {
        job:    { select: { id: true, title: true, startTime: true } },
        worker: { select: WORKER_SELECT },
      },
    });

    this.notifications
      .notify(app.job.employerId, {
        type:  'GENERAL',
        title: 'נמצא מחליף! ⚡',
        body:  `${updated?.worker?.fullName ?? 'עובד'} אושר אוטומטית ל"${app.job.title}"`,
        jobId: app.jobId, applicationId: appId,
      })
      .catch(() => { /* fire-and-forget */ });

    this.broadcastToEmployer(app.job.employerId, 'application-update', {
      applicationId: appId, kind: 'claimed',
    }).catch(() => { /* fire-and-forget */ });

    return { application: updated, chat };
  }

  // PATCH /jobs/:id/cancel — employer cancels an OPEN job (System 4).
  // Blocked once a worker is APPROVED/COMPLETED (use complete / no-show
  // instead — cancelling under an approved worker would be unfair).
  async cancel(jobId: string, employerId: string) {
    const job = await this.prisma.db.job.findUnique({
      where: { id: jobId },
      include: {
        applications: {
          where: { status: { in: ['APPROVED', 'COMPLETED', 'PENDING'] } },
          select: { id: true, status: true, workerId: true },
        },
      },
    });
    if (!job) throw new NotFoundException('Job ' + jobId + ' not found');
    if (job.employerId !== employerId) throw new ForbiddenException('Not your job');
    if (job.cancelledAt) throw new ConflictException('הג׳סטה כבר בוטלה');

    const hasCommitted = job.applications.some(
      (a: any) => a.status === 'APPROVED' || a.status === 'COMPLETED',
    );
    if (hasCommitted) {
      throw new ConflictException(
        'לא ניתן לבטל — כבר אושר עובד לג׳סטה הזו. סמנו השלמה או אי-הגעה במקום',
      );
    }

    const pending = job.applications.filter((a: any) => a.status === 'PENDING');
    await this.prisma.db.$transaction([
      this.prisma.db.job.update({
        where: { id: jobId },
        data:  { isActive: false, cancelledAt: new Date() },
      }),
      // Manual cancellation — applicants are NOT re-invited later (autoRejected=false)
      this.prisma.db.application.updateMany({
        where: { jobId, status: 'PENDING' },
        data:  { status: 'REJECTED', autoRejected: false },
      }),
    ]);

    for (const a of pending) {
      this.notifications
        .notify(a.workerId, {
          type:  'GENERAL',
          title: 'הג׳סטה בוטלה',
          body:  `"${job.title}" בוטלה על ידי המעסיק. מצטערים! יש עוד ג׳סטות בפיד`,
          jobId, applicationId: a.id,
        })
        .catch(() => { /* fire-and-forget */ });
    }

    return { ok: true, cancelledAt: new Date(), rejectedPending: pending.length };
  }
}
