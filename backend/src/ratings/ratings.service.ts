import {
  Injectable, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoreService } from '../score/score.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRatingDto } from './dto/create-rating.dto';

const RATER_SELECT = { id: true, fullName: true, avatarUrl: true, role: true } as const;

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly score: ScoreService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * POST /ratings — mutual rating after a completed gesta.
   * Valid pairs on a job with a COMPLETED application:
   *   employer → worker who completed it
   *   worker (who completed it) → employer
   */
  async create(raterId: string, dto: CreateRatingDto) {
    const { jobId, toUserId, score, comment } = dto;
    if (raterId === toUserId) {
      throw new ForbiddenException('You cannot rate yourself');
    }

    const job = await this.prisma.db.job.findUnique({
      where: { id: jobId },
      include: {
        applications: {
          where: { status: 'COMPLETED' },
          select: { workerId: true },
        },
      },
    });
    if (!job) throw new NotFoundException('Job ' + jobId + ' not found');

    const completedWorkerIds = job.applications.map((a: any) => a.workerId);
    const validPair =
      (raterId === job.employerId && completedWorkerIds.includes(toUserId)) ||
      (completedWorkerIds.includes(raterId) && toUserId === job.employerId);
    if (!validPair) {
      throw new ForbiddenException('Only participants of a completed gesta can rate each other');
    }

    const existing = await this.prisma.db.rating.findUnique({
      where: { jobId_fromUserId: { jobId, fromUserId: raterId } },
    });
    if (existing) throw new ConflictException('You have already rated this gesta');

    const rating = await this.prisma.db.rating.create({
      data: { jobId, fromUserId: raterId, toUserId, score, comment: comment ?? null },
      include: { fromUser: { select: RATER_SELECT } },
    });

    // Re-aggregate the target's rating_avg + count, then their Jesta Score.
    const agg = await this.prisma.db.rating.aggregate({
      where: { toUserId },
      _avg:   { score: true },
      _count: { score: true },
    });
    await this.prisma.db.user.update({
      where: { id: toUserId },
      data: {
        rating:      Math.round((agg._avg.score ?? 0) * 10) / 10,
        ratingCount: agg._count.score,
      },
    });
    await this.score.recalculate(toUserId);

    this.notifications
      .notify(toUserId, {
        type:  'GENERAL',
        title: 'קיבלת דירוג חדש ⭐',
        body:  `דורגת ${score}/5 על "${job.title}"`,
        jobId,
      })
      .catch(() => { /* never break rating on notify failure */ });

    return rating;
  }

  /**
   * GET /ratings/pending — completed gestas where the current user still owes
   * the other side a rating. Powers the post-completion rating prompt.
   */
  async pendingFor(userId: string) {
    const apps = await this.prisma.db.application.findMany({
      where: {
        status: 'COMPLETED',
        OR: [
          { workerId: userId },              // I'm the worker
          { job: { employerId: userId } },   // I'm the employer
        ],
      },
      include: {
        job: {
          select: {
            id: true, title: true,
            employer: { select: RATER_SELECT },
          },
        },
        worker: { select: RATER_SELECT },
      },
      orderBy: { completedAt: 'desc' },
    });
    if (apps.length === 0) return [];

    const jobIds = apps.map((a: any) => a.jobId);
    const mine = await this.prisma.db.rating.findMany({
      where: { fromUserId: userId, jobId: { in: jobIds } },
      select: { jobId: true },
    });
    const ratedJobIds = new Set(mine.map((r: any) => r.jobId));

    return apps
      .filter((a: any) => !ratedJobIds.has(a.jobId))
      .map((a: any) => ({
        jobId:       a.jobId,
        jobTitle:    a.job.title,
        completedAt: a.completedAt,
        // the counterparty to rate
        toUser: a.workerId === userId ? a.job.employer : a.worker,
      }));
  }

  /** GET /ratings/user/:id — latest ratings received (public, for profiles) */
  async forUser(userId: string) {
    const [items, agg] = await Promise.all([
      this.prisma.db.rating.findMany({
        where: { toUserId: userId },
        include: { fromUser: { select: RATER_SELECT }, job: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.db.rating.aggregate({
        where: { toUserId: userId },
        _avg:   { score: true },
        _count: { score: true },
      }),
    ]);
    return {
      items,
      average: Math.round((agg._avg.score ?? 0) * 10) / 10,
      count:   agg._count.score,
    };
  }
}
