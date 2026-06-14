import {
  Injectable, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOfferDto } from './dto/create-offer.dto';

const WORKER_SELECT = {
  id: true, fullName: true, avatarUrl: true,
  rating: true, ratingCount: true, jestaScore: true, completedJobs: true,
} as const;

const EMPLOYER_SELECT = {
  id: true, fullName: true, avatarUrl: true, rating: true, ratingCount: true,
} as const;

const JOB_SELECT = {
  id: true, title: true, description: true, pay: true, address: true,
  startTime: true, endTime: true, isActive: true, perks: true,
} as const;

/**
 * Direct hiring (System 3, Pro): a Pro employer sends a personal job offer to
 * a specific worker; the worker sees it in "הצעות אישיות" and can accept
 * (instant approval + chat) or decline.
 */
@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // POST /offers — Pro employer → worker
  async create(employerId: string, role: string, dto: CreateOfferDto) {
    if (role !== 'EMPLOYER') throw new ForbiddenException('Only employers can send offers');

    const employer = await this.prisma.db.user.findUnique({
      where: { id: employerId },
      select: { isPro: true, fullName: true },
    });
    if (!employer?.isPro) {
      throw new ForbiddenException('שליחת הצעות ישירות זמינה למנויי פרו בלבד');
    }

    const job = await this.prisma.db.job.findUnique({ where: { id: dto.jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.employerId !== employerId) throw new ForbiddenException('Not your job');
    if (!job.isActive) throw new ConflictException('הג׳סטה כבר לא פעילה');

    const worker = await this.prisma.db.user.findUnique({
      where: { id: dto.workerId },
      select: { id: true, role: true, fullName: true },
    });
    if (!worker || worker.role !== 'WORKER') throw new NotFoundException('Worker not found');

    const existing = await this.prisma.db.jobOffer.findUnique({
      where: { jobId_workerId: { jobId: dto.jobId, workerId: dto.workerId } },
    });
    if (existing) throw new ConflictException('כבר שלחת הצעה לעובד הזה עבור הג׳סטה הזו');

    const offer = await this.prisma.db.jobOffer.create({
      data: {
        jobId: dto.jobId, employerId, workerId: dto.workerId,
        message: dto.message ?? null,
      },
      include: {
        job:    { select: JOB_SELECT },
        worker: { select: WORKER_SELECT },
      },
    });

    this.notifications
      .notify(dto.workerId, {
        type:  'DIRECT_OFFER',
        title: 'קיבלת הצעת עבודה אישית! ✨',
        body:  `${employer.fullName} מזמין אותך אישית ל"${job.title}"`,
        jobId: dto.jobId, offerId: offer.id,
      })
      .catch(() => { /* fire-and-forget */ });

    return offer;
  }

  // GET /offers/me — worker's incoming offers ("הצעות אישיות")
  async listForWorker(workerId: string) {
    return this.prisma.db.jobOffer.findMany({
      where: { workerId },
      include: {
        job:      { select: JOB_SELECT },
        employer: { select: EMPLOYER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // GET /offers/sent — employer's outgoing offers (for UI state)
  async listForEmployer(employerId: string) {
    return this.prisma.db.jobOffer.findMany({
      where: { employerId },
      include: {
        job:    { select: { id: true, title: true } },
        worker: { select: WORKER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // PATCH /offers/:id/accept — instant approval + chat
  async accept(offerId: string, workerId: string) {
    const offer = await this.prisma.db.jobOffer.findUnique({
      where: { id: offerId },
      include: { job: true, worker: { select: { fullName: true } } },
    });
    if (!offer)                       throw new NotFoundException('Offer not found');
    if (offer.workerId !== workerId)  throw new ForbiddenException('Not your offer');
    if (offer.status !== 'PENDING')   throw new ConflictException('ההצעה כבר נענתה');
    if (!offer.job.isActive)          throw new ConflictException('הג׳סטה כבר לא פעילה');

    // Same reliability gates as a regular application
    const worker = await this.prisma.db.user.findUnique({
      where: { id: workerId },
      select: { suspendedUntil: true, reviewFlag: true },
    });
    if (worker?.reviewFlag) {
      throw new ForbiddenException('החשבון שלך הוקפא לבדיקה — לא ניתן לקבל הצעות');
    }
    if (worker?.suspendedUntil && new Date(worker.suspendedUntil) > new Date()) {
      throw new ForbiddenException('החשבון מושעה כרגע — לא ניתן לקבל הצעות');
    }

    // Overlap guard (same rule as apply): 3+ approved overlapping jobs block
    const overlaps = await this.prisma.db.application.findMany({
      where: {
        workerId, status: 'APPROVED',
        job: { startTime: { lt: offer.job.endTime }, endTime: { gt: offer.job.startTime } },
      },
      include: { job: { select: { id: true, title: true, startTime: true, endTime: true } } },
    });
    if (overlaps.length >= 3) {
      throw new ConflictException({
        message: 'לא ניתן לקבל את ההצעה — יש לך כבר 3 משמרות מאושרות שחופפות בזמן',
        code: 'OVERLAP_LIMIT',
        conflicts: overlaps.map((a: any) => a.job),
      });
    }

    const now = new Date();

    // Accept + approve atomically. The application may already exist (the
    // worker applied on their own before the offer) — upsert covers both.
    const [updatedOffer, application] = await this.prisma.db.$transaction([
      this.prisma.db.jobOffer.update({
        where: { id: offerId },
        data:  { status: 'ACCEPTED', respondedAt: now },
      }),
      this.prisma.db.application.upsert({
        where:  { jobId_workerId: { jobId: offer.jobId, workerId } },
        create: { jobId: offer.jobId, workerId, status: 'APPROVED', approvedAt: now },
        update: { status: 'APPROVED', approvedAt: now, autoRejected: false },
        include: { job: { select: { id: true, title: true, startTime: true } } },
      }),
      this.prisma.db.job.update({
        where: { id: offer.jobId },
        data:  { isActive: false },
      }),
    ]);

    // Auto-reject other pending applicants (position filled), same as approve
    await this.prisma.db.application.updateMany({
      where: { jobId: offer.jobId, workerId: { not: workerId }, status: 'PENDING' },
      data:  { status: 'REJECTED', autoRejected: true },
    });

    let chat = await this.prisma.db.chat.findUnique({
      where: { applicationId: application.id },
    });
    if (!chat) {
      chat = await this.prisma.db.chat.create({
        data: {
          applicationId: application.id,
          employerId: offer.employerId,
          workerId,
        },
        include: {
          employer: { select: { id: true, fullName: true, avatarUrl: true } },
          worker:   { select: { id: true, fullName: true, avatarUrl: true } },
        },
      });
    }

    this.notifications
      .notify(offer.employerId, {
        type:  'OFFER_RESPONSE',
        title: 'ההצעה התקבלה! ⚡',
        body:  `${offer.worker.fullName} קיבל את ההצעה ל"${offer.job.title}"`,
        jobId: offer.jobId, offerId,
      })
      .catch(() => { /* fire-and-forget */ });

    return { offer: updatedOffer, application, chat };
  }

  // PATCH /offers/:id/decline
  async decline(offerId: string, workerId: string) {
    const offer = await this.prisma.db.jobOffer.findUnique({
      where: { id: offerId },
      include: { job: { select: { title: true } }, worker: { select: { fullName: true } } },
    });
    if (!offer)                      throw new NotFoundException('Offer not found');
    if (offer.workerId !== workerId) throw new ForbiddenException('Not your offer');
    if (offer.status !== 'PENDING')  throw new ConflictException('ההצעה כבר נענתה');

    const updated = await this.prisma.db.jobOffer.update({
      where: { id: offerId },
      data:  { status: 'DECLINED', respondedAt: new Date() },
    });

    this.notifications
      .notify(offer.employerId, {
        type:  'OFFER_RESPONSE',
        title: 'ההצעה נדחתה',
        body:  `${offer.worker.fullName} דחה את ההצעה ל"${offer.job.title}"`,
        jobId: offer.jobId, offerId,
      })
      .catch(() => { /* fire-and-forget */ });

    return updated;
  }
}
