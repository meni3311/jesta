import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto }  from './dto/create-job.dto';
import { QueryJobsDto }  from './dto/query-jobs.dto';

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

const WORKER_SELECT = {
  id: true, fullName: true, avatarUrl: true,
  rating: true, completedJobs: true,
} as const;

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /jobs
  async findAll(query: QueryJobsDto) {
    const { lat, lng, radius = 10, minPay } = query;
    const jobs = await this.prisma.job.findMany({
      where: {
        isActive: true,
        ...(minPay !== undefined && { pay: { gte: minPay } }),
      },
      include: {
        employer: { select: { id: true, fullName: true, avatarUrl: true, rating: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (lat !== undefined && lng !== undefined) {
      return jobs.filter((j) => haversineKm(lat, lng, j.lat, j.lng) <= radius);
    }
    return jobs;
  }

  // GET /jobs/employer
  async getEmployerJobs(employerId: string) {
    return this.prisma.job.findMany({
      where: { employerId },
      include: {
        _count: { select: { applications: true } },
        applications: {
          where: { status: { in: ['PENDING', 'APPROVED', 'REJECTED'] } },
          include: { worker: { select: WORKER_SELECT } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // GET /jobs/applications/me — the worker's own applications ("my shifts")
  async getMyApplications(workerId: string) {
    return this.prisma.application.findMany({
      where: { workerId },
      include: {
        job: {
          include: {
            employer: { select: { id: true, fullName: true, avatarUrl: true, rating: true } },
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
    return this.prisma.job.create({
      data: {
        ...dto,
        startTime: new Date(dto.startTime),
        endTime:   new Date(dto.endTime),
        perks:     dto.perks ?? [],
        employerId,
      },
      include: {
        employer: { select: { id: true, fullName: true, rating: true, avatarUrl: true } },
        _count:   { select: { applications: true } },
      },
    });
  }

  // GET /jobs/:id
  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        employer:     { select: { id: true, fullName: true, rating: true, avatarUrl: true } },
        applications: { include: { worker: { select: WORKER_SELECT } } },
      },
    });
    if (!job) throw new NotFoundException('Job ' + id + ' not found');
    return job;
  }

  // POST /jobs/:id/apply
  async apply(jobId: string, workerId: string, role: string) {
    if (role !== 'WORKER') {
      throw new ForbiddenException('Only workers can apply to jobs');
    }
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job)          throw new NotFoundException('Job ' + jobId + ' not found');
    if (!job.isActive) throw new ConflictException('This job is no longer available');

    const existing = await this.prisma.application.findUnique({
      where: { jobId_workerId: { jobId, workerId } },
    });
    if (existing) throw new ConflictException('You have already applied to this job');

    return this.prisma.application.create({
      data: { jobId, workerId },
      include: {
        job:    { select: { id: true, title: true } },
        worker: { select: WORKER_SELECT },
      },
    });
  }

  // PATCH /jobs/:jobId/applications/:appId/approve
  async approveApplication(jobId: string, appId: string, employerId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job ' + jobId + ' not found');
    if (job.employerId !== employerId) throw new ForbiddenException('Not your job');

    const application = await this.prisma.application.findUnique({
      where: { id: appId },
      include: { worker: { select: WORKER_SELECT } },
    });
    if (!application || application.jobId !== jobId) {
      throw new NotFoundException('Application ' + appId + ' not found on job ' + jobId);
    }
    if (application.status !== 'PENDING') {
      throw new ConflictException('Application is already ' + application.status);
    }

    const [updatedApp, , , chat] = await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id: appId },
        data:  { status: 'APPROVED' },
        include: {
          worker: { select: WORKER_SELECT },
          job:    { select: { id: true, title: true } },
        },
      }),
      this.prisma.job.update({
        where: { id: jobId },
        data:  { isActive: false },
      }),
      // Position filled — reject all other pending applications on this job
      // so workers aren't left waiting forever.
      this.prisma.application.updateMany({
        where: { jobId, id: { not: appId }, status: 'PENDING' },
        data:  { status: 'REJECTED' },
      }),
      this.prisma.chat.create({
        data: { applicationId: appId, employerId, workerId: application.workerId },
        include: {
          employer: { select: { id: true, fullName: true, avatarUrl: true } },
          worker:   { select: { id: true, fullName: true, avatarUrl: true } },
        },
      }),
    ]);

    return { application: updatedApp, chat };
  }

  // PATCH /jobs/:jobId/applications/:appId/reject
  async rejectApplication(jobId: string, appId: string, employerId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job ' + jobId + ' not found');
    if (job.employerId !== employerId) throw new ForbiddenException('Not your job');

    const application = await this.prisma.application.findUnique({
      where: { id: appId },
    });
    if (!application || application.jobId !== jobId) {
      throw new NotFoundException('Application ' + appId + ' not found');
    }

    return this.prisma.application.update({
      where: { id: appId },
      data:  { status: 'REJECTED' },
      include: { worker: { select: WORKER_SELECT } },
    });
  }
}
