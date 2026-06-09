import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { ConfigService }    from '@nestjs/config';
import { PrismaService }    from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { verificationEmailHtml } from './email.templates';
// crypto no longer needed — OTP is numeric
import { Resend }  from 'resend';

@Injectable()
export class UsersService {
  private resend: Resend;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'));
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
      select: {
        id: true, email: true, fullName: true, role: true,
        avatarUrl: true, phone: true, isVerified: true,
        rating: true, completedJobs: true, createdAt: true,
      },
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
      from:    'onboarding@resend.dev',
      to:      'meni3311il@gmail.com',
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
