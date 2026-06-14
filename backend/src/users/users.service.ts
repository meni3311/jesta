import {
  Injectable, NotFoundException, BadRequestException,
  InternalServerErrorException, ForbiddenException,
} from '@nestjs/common';
import { ConfigService }    from '@nestjs/config';
import { PrismaService }    from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpsertAvailabilityDto } from './dto/upsert-availability.dto';
import { verificationEmailHtml } from './email.templates';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Resend }  from 'resend';

/** Columns returned to the client in every profile response */
const PROFILE_SELECT = {
  id: true, email: true, fullName: true, role: true,
  avatarUrl: true, phone: true, isVerified: true,
  rating: true, ratingCount: true, jestaScore: true, completedJobs: true,
  showUpCount: true, noShowCount: true,
  warningFlag: true, suspendedUntil: true, reviewFlag: true,
  isPro: true, proFeatures: true, availability: true,
  createdAt: true,
} as const;

/** Worker card shown to Pro employers in the direct-hiring browse list */
const BROWSE_SELECT = {
  id: true, fullName: true, avatarUrl: true,
  rating: true, ratingCount: true, jestaScore: true,
  completedJobs: true, availability: true,
} as const;

/** Worker availability categories (System 2 spec) */
const WORKER_CATEGORIES = ['delivery', 'babysit', 'events', 'pets', 'warehouse', 'other'];

/** Hebrew day letters for the legacy jsonb mirror (0 = Sunday) */
const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

/** Map any job category id onto the worker taxonomy ('other' as catch-all) */
function normalizeJobCategory(category: string | null | undefined): string | null {
  if (!category) return null;
  return WORKER_CATEGORIES.includes(category) ? category : 'other';
}

/** Day-of-week (0=Sun) + "HH:MM" of a timestamp in Israel time */
function israelDayAndTime(d: Date): { day: number; hhmm: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  } as Intl.DateTimeFormatOptions).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { day: Math.max(0, days.indexOf(get('weekday'))), hhmm: `${get('hour')}:${get('minute')}` };
}

@Injectable()
export class UsersService {
  private resend:   Resend;
  private supabase: SupabaseClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'));

    // Use the service-role key so storage operations bypass Row Level Security
    this.supabase = createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );
  }

  // ── PATCH /users/profile ──────────────────────────────────────────────────
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName  !== undefined && { fullName:  dto.fullName  }),
        ...(dto.phone     !== undefined && { phone:     dto.phone     }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
      select: PROFILE_SELECT as any,
    });

    return updated;
  }

  // ── POST /users/avatar ─────────────────────────────────────────────────────
  // Accepts a multer file (in memory), streams it to the Supabase "avatars"
  // bucket, stores the public URL in the users table, and returns the updated
  // user object so the client can refresh its session immediately.
  async uploadAvatar(userId: string, file: { buffer: Buffer; mimetype: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Namespaced path keeps the bucket tidy and overwrites on re-upload
    const ext  = file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await this.supabase.storage
      .from('avatars')
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert:      true,           // overwrite on every upload
      });

    if (uploadError) {
      console.error('[Jesta] Supabase avatar upload error:', uploadError.message);
      throw new InternalServerErrorException('Avatar upload failed');
    }

    // getPublicUrl returns the full absolute public URL for the bucket object.
    // We store it clean (no query params) — cache-busting is the frontend's job.
    const { data: urlData } = this.supabase.storage
      .from('avatars')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    const updated = await this.prisma.user.update({
      where:  { id: userId },
      data:   { avatarUrl: publicUrl },
      select: PROFILE_SELECT as any,
    });

    return updated;
  }

  // ── POST /users/send-verification ─────────────────────────────────────────
  async sendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)           throw new NotFoundException('User not found');
    if (user.isVerified) throw new BadRequestException('Email already verified');

    // Generate a 6-digit OTP valid 30 min
    const otp    = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken:  otp,
        emailVerificationExpiry: expiry,
      },
    });

    await this.resend.emails.send({
      from:    this.config.get<string>('RESEND_FROM') ?? 'Jesta <noreply@jesta.co.il>',
      to:      user.email,
      subject: `קוד האימות שלך: ${otp} — Jesta ⚡`,
      html:    verificationEmailHtml({ fullName: user.fullName, code: otp }),
    });

    return { message: 'Verification email sent' };
  }

  // ── GET /users/verify-email/:token ────────────────────────────────────────
  async verifyEmail(token: string): Promise<{ redirectUrl: string }> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

    if (!token) {
      return { redirectUrl: `${frontendUrl}?verified=error` };
    }

    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user || !user.emailVerificationExpiry) {
      return { redirectUrl: `${frontendUrl}?verified=invalid` };
    }

    if (new Date() > user.emailVerificationExpiry) {
      return { redirectUrl: `${frontendUrl}?verified=expired` };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified:              true,
        emailVerificationToken:  null,
        emailVerificationExpiry: null,
      },
    });

    return { redirectUrl: `${frontendUrl}?verified=success` };
  }

  // ── GET /users/me ──────────────────────────────────────────────────────────
  // Fresh full profile — lets the client refresh jestaScore / isPro / flags
  // without re-logging-in.
  async getMe(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where:  { id: userId },
      select: PROFILE_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ── GET /users/:id/public ──────────────────────────────────────────────────
  // Public profile card: rating + count + Jesta Score (System 1 display).
  async getPublicProfile(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, fullName: true, avatarUrl: true, role: true,
        rating: true, ratingCount: true, jestaScore: true,
        completedJobs: true, warningFlag: true, createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const recentRatings = await this.prisma.db.rating.findMany({
      where:   { toUserId: userId },
      include: { fromUser: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return { ...user, recentRatings };
  }

  // ── PATCH /users/availability ──────────────────────────────────────────────
  // Worker opts in/out of the Pro direct-hiring browse list.
  async updateAvailability(userId: string, role: string, dto: UpdateAvailabilityDto) {
    if (role !== 'WORKER') {
      throw new ForbiddenException('Only workers can set an availability profile');
    }
    return this.prisma.db.user.update({
      where:  { id: userId },
      data:   { availability: { ...dto } },
      select: PROFILE_SELECT,
    });
  }

  // ── GET /users/availability ────────────────────────────────────────────────
  // The worker's own availability profile (weekly grid + preferences).
  async getMyAvailability(userId: string) {
    const slots = await this.prisma.db.availabilitySlot.findMany({
      where:   { userId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    const first = slots[0] ?? null;
    return {
      isSet:          slots.length > 0,
      slots:          slots.map((s: any) => ({
        dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime,
      })),
      minWage:        first?.minWage ?? 40,
      categories:     first?.categories ?? [],
      isOpenToOffers: first?.isOpenToOffers ?? true,
    };
  }

  // ── PUT /users/availability ────────────────────────────────────────────────
  // Replace the worker's entire availability profile atomically (System 2).
  // Also mirrors a compact summary into the legacy users.availability jsonb so
  // existing UI (worker browse cards) keeps displaying something meaningful.
  async upsertAvailability(userId: string, role: string, dto: UpsertAvailabilityDto) {
    if (role !== 'WORKER') {
      throw new ForbiddenException('Only workers can set an availability profile');
    }
    for (const s of dto.slots) {
      if (s.endTime <= s.startTime) {
        throw new BadRequestException(`Invalid slot ${s.startTime}-${s.endTime}: end must be after start`);
      }
    }

    // Legacy jsonb mirror: open flag + day letters + overall hour range
    const dayLabels = [...new Set(dto.slots.map((s) => s.dayOfWeek))]
      .sort((a, b) => a - b)
      .map((d) => DAY_LETTERS[d]);
    const starts = dto.slots.map((s) => s.startTime).sort();
    const ends   = dto.slots.map((s) => s.endTime).sort();
    const legacyMirror = {
      open:  dto.isOpenToOffers && dto.slots.length > 0,
      days:  dayLabels,
      hours: dto.slots.length ? `${starts[0]}-${ends[ends.length - 1]}` : undefined,
    };

    await this.prisma.db.$transaction([
      this.prisma.db.availabilitySlot.deleteMany({ where: { userId } }),
      ...(dto.slots.length
        ? [this.prisma.db.availabilitySlot.createMany({
            data: dto.slots.map((s) => ({
              userId,
              dayOfWeek:      s.dayOfWeek,
              startTime:      s.startTime,
              endTime:        s.endTime,
              minWage:        dto.minWage,
              categories:     dto.categories,
              isOpenToOffers: dto.isOpenToOffers,
            })),
          })]
        : []),
      this.prisma.db.user.update({
        where: { id: userId },
        data:  { availability: legacyMirror },
      }),
    ]);

    return this.getMyAvailability(userId);
  }

  // ── GET /users/available-workers?jobId= ────────────────────────────────────
  // Pro employers browse workers who opened their availability profile,
  // best Jesta Score first. Gated server-side.
  //
  // With ?jobId= the list is MATCHED against that job (System 2):
  //   availability overlaps the job's time window · minWage <= job wage ·
  //   categories include the job's category. Matching slots are returned so
  //   the UI can highlight them.
  async getAvailableWorkers(employerId: string, jobId?: string) {
    const employer = await this.prisma.db.user.findUnique({
      where: { id: employerId },
      select: { isPro: true, role: true },
    });
    if (employer?.role !== 'EMPLOYER') throw new ForbiddenException('Employers only');
    if (!employer.isPro) {
      throw new ForbiddenException('גיוס ישיר זמין למנויי פרו בלבד');
    }

    // All open availability rows of eligible workers, grouped per worker
    const rows = await this.prisma.db.availabilitySlot.findMany({
      where: {
        isOpenToOffers: true,
        user: { role: 'WORKER', reviewFlag: false },
      },
      include: { user: { select: BROWSE_SELECT } },
    });

    const byWorker = new Map<string, { user: any; slots: any[] }>();
    for (const r of rows) {
      const entry = byWorker.get(r.userId) ?? { user: r.user, slots: [] };
      entry.slots.push(r);
      byWorker.set(r.userId, entry);
    }

    let job: any = null;
    let jobDay = -1, jobStart = '', jobEnd = '', jobCat: string | null = null;
    if (jobId) {
      job = await this.prisma.db.job.findUnique({ where: { id: jobId } });
      if (!job) throw new NotFoundException('Job not found');
      if (job.employerId !== employerId) throw new ForbiddenException('Not your job');
      const s = israelDayAndTime(new Date(job.startTime));
      const e = israelDayAndTime(new Date(job.endTime));
      jobDay   = s.day;
      jobStart = s.hhmm;
      // Shift crossing midnight: match against the start day until 24:00
      jobEnd   = e.day === s.day ? e.hhmm : '24:00';
      jobCat   = normalizeJobCategory(job.category);
    }

    const result: any[] = [];
    for (const { user, slots } of byWorker.values()) {
      const profile = slots[0];
      let matchingSlots: any[] = [];

      if (job) {
        // 1) wage: worker's minimum must be covered by the job's pay
        if ((profile?.minWage ?? 0) > job.pay) continue;
        // 2) category: empty preference = open to anything
        const cats: string[] = profile?.categories ?? [];
        if (jobCat && cats.length > 0 && !cats.includes(jobCat)) continue;
        // 3) time overlap on the job's day ("HH:MM" strings compare correctly)
        matchingSlots = slots.filter(
          (s: any) => s.dayOfWeek === jobDay && s.startTime < jobEnd && s.endTime > jobStart,
        );
        if (matchingSlots.length === 0) continue;
      }

      result.push({
        ...user,
        minWage:        profile?.minWage ?? 0,
        categories:     profile?.categories ?? [],
        isOpenToOffers: true,
        slots: slots.map((s: any) => ({
          dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime,
        })),
        matchingSlots: matchingSlots.map((s: any) => ({
          dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime,
        })),
      });
    }

    result.sort((a, b) => (b.jestaScore ?? 0) - (a.jestaScore ?? 0));
    return result.slice(0, 50);
  }

  // ── PATCH /users/dev/pro-toggle ────────────────────────────────────────────
  // DEV ONLY: simulate the Pro plan until payments exist (System 3).
  // Disabled in production builds.
  async toggleProDev(userId: string) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dev-only endpoint');
    }
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { isPro: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== 'EMPLOYER') {
      throw new ForbiddenException('Pro is an employer plan');
    }
    return this.prisma.db.user.update({
      where:  { id: userId },
      data:   { isPro: !user.isPro },
      select: PROFILE_SELECT,
    });
  }
}
