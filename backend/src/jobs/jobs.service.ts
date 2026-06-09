import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto }  from './dto/create-job.dto';
import { QueryJobsDto }  from './dto/query-jobs.dto';
import { ApplyJobDto }   from './dto/apply-job.dto';

// Haversine distance (km) between two lat/lng points
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R  = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /jobs ─────────────────────────────────────────────────────────────
  async findAll(query: QueryJobsDto) {
    const { lat, lng, radius = 10, minPay } = query;

    const jobs = await this.prisma.job.findMany({
      where: {
        isActive: true,
        ...(minPay !== undefined && { pay: { gte: minPay } }),
      },
      include: {
        employer: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            rating: true,
          },
        },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter by radius in JS (Prisma doesn't natively support Haversine;
    // for production replace with a PostGIS query or Supabase RPC)
    if (lat !== undefined && lng !== undefined) {
      return jobs.filter(
        (j) => haversineKm(lat, lng, j.lat, j.lng) <= radius,
      );
    }

    return jobs;
  }

  // ── POST /jobs ────────────────────────────────────────────────────────────
  async create(employerId: string, dto: CreateJobDto) {
    return this.prisma.job.create({
      data: {
        ...dto,
        startTime: new Date(dto.startTime),
        endTime:   new Date(dto.endTime),
        perks:     dto.perks ?? [],
        employerId,
      },
      include: {
        employer: { select: { id: true, fullName: true } },
      },
    });
  }

  // ── GET /jobs/:id ─────────────────────────────────────────────────────────
  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        employer:     { select: { id: true, fullName: true, rating: true } },
        applications: {
          include: { worker: { select: { id: true, fullName: true, rating: true } } },
        },
      },
    });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  // ── POST /jobs/:id/apply ──────────────────────────────────────────────────
  async apply(jobId: string, dto: ApplyJobDto) {
    // Verify job exists and is still active
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job)           throw new NotFoundException(`Job ${jobId} not found`);
    if (!job.isActive)  throw new ConflictException('This job is no longer available');

    // Prevent duplicate applications (the DB unique constraint also guards this)
    const existing = await this.prisma.application.findUnique({
      where: { jobId_workerId: { jobId, workerId: dto.workerId } },
    });
    if (existing) throw new ConflictException('You have already applied to this job');

    return this.prisma.application.create({
      data: { jobId, workerId: dto.workerId },
      include: {
        job:    { select: { id: true, title: true } },
        worker: { select: { id: true, fullName: true } },
      },
    });
  }
}
