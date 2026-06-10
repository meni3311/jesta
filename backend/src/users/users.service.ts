import {
  Injectable, NotFoundException, BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService }    from '@nestjs/config';
import { PrismaService }    from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { verificationEmailHtml } from './email.templates';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Resend }  from 'resend';

/** Columns returned to the client in every profile response */
const PROFILE_SELECT = {
  id: true, email: true, fullName: true, role: true,
  avatarUrl: true, phone: true, isVerified: true,
  rating: true, completedJobs: true, createdAt: true,
} as const;

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
      select: PROFILE_SELECT,
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
      select: PROFILE_SELECT,
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
}
