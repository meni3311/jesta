import {
  Injectable, ConflictException, UnauthorizedException,
  NotFoundException, BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto }   from './dto/register.dto';
import { LoginDto }      from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { verificationEmailHtml } from '../users/email.templates';
import * as bcrypt from 'bcrypt';
import * as jwt    from 'jsonwebtoken';
import { Resend }  from 'resend';

const SALT_ROUNDS = 12;

/** Fields returned to the client in every auth response */
const USER_SELECT = {
  id:            true,
  email:         true,
  fullName:      true,
  role:          true,
  avatarUrl:     true,
  phone:         true,
  isVerified:    true,
  rating:        true,
  ratingCount:   true,
  jestaScore:    true,
  completedJobs: true,
  warningFlag:   true,
  suspendedUntil:true,
  isPro:         true,
  proFeatures:   true,
  availability:  true,
  createdAt:     true,
} as const;

@Injectable()
export class AuthService {
  private resend: Resend;

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
  ) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'));
  }

  // ── Register ───────────────────────────────────────────────────────────────
  // Creates the account, stores a 6-digit OTP, fires the email, and returns
  // { pendingVerification: true, email } — no token until the OTP is confirmed.
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where:  { email: dto.email },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const otp    = this.generateOtp();
    const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    const user = await this.prisma.user.create({
      data: {
        email:                   dto.email,
        passwordHash,
        fullName:                dto.fullName,
        role:                    dto.role,
        phone:                   dto.phone,
        avatarUrl:               dto.avatarUrl,
        emailVerificationToken:  otp,
        emailVerificationExpiry: expiry,
      },
      select: USER_SELECT,
    });

    // Fire-and-forget — don't let an email failure block registration
    this.sendOtpEmail(user.email, user.fullName, otp).catch(err =>
      console.error('[Jesta] OTP email failed:', err.message),
    );

    return { pendingVerification: true as const, email: dto.email };
  }

  // ── Verify email + login ───────────────────────────────────────────────────
  // Validates the 6-digit OTP, marks the user as verified, and returns a
  // full { user, token } session so the frontend can log in immediately.
  async verifyEmailAndLogin(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({
      where:  { email: dto.email },
      select: {
        ...USER_SELECT,
        emailVerificationToken:  true,
        emailVerificationExpiry: true,
      },
    });

    if (!user)           throw new NotFoundException('User not found');
    if (user.isVerified) throw new BadRequestException('Email already verified');

    if (!user.emailVerificationToken) {
      throw new BadRequestException('No verification code found. Please request a new one.');
    }
    if (user.emailVerificationToken !== dto.code) {
      throw new UnauthorizedException('קוד האימות שגוי');
    }
    if (user.emailVerificationExpiry && new Date() > user.emailVerificationExpiry) {
      throw new BadRequestException('קוד האימות פג תוקף. בקש קוד חדש.');
    }

    const { emailVerificationToken: _t, emailVerificationExpiry: _e, ...safeUser } = user;
    void _t; void _e;

    const verifiedUser = await this.prisma.user.update({
      where: { email: dto.email },
      data:  {
        isVerified:              true,
        emailVerificationToken:  null,
        emailVerificationExpiry: null,
      },
      select: USER_SELECT,
    });

    return { user: verifiedUser, token: this.sign(verifiedUser.id, verifiedUser.role) };
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where:  { email: dto.email },
      select: { ...USER_SELECT, passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // Unverified users must complete OTP verification before getting a session.
    // Issue a fresh OTP and tell the client to show the OTP screen.
    if (!user.isVerified) {
      await this.issueOtp(user.email);
      return { pendingVerification: true as const, email: user.email };
    }

    const { passwordHash: _pw, ...safeUser } = user;
    void _pw;
    return { user: safeUser, token: this.sign(user.id, user.role) };
  }

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  async resendOtp(email: string) {
    const user = await this.prisma.user.findUnique({
      where:  { email },
      select: { id: true, isVerified: true },
    });
    // Don't reveal whether the email exists
    if (user && !user.isVerified) {
      await this.issueOtp(email);
    }
    return { message: 'If the account exists, a new code was sent.' };
  }

  /** Generate + persist a fresh OTP and email it (fire-and-forget). */
  private async issueOtp(email: string) {
    const otp    = this.generateOtp();
    const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    const user = await this.prisma.user.update({
      where:  { email },
      data:   { emailVerificationToken: otp, emailVerificationExpiry: expiry },
      select: { email: true, fullName: true },
    });
    this.sendOtpEmail(user.email, user.fullName, otp).catch(err =>
      console.error('[Jesta] OTP email failed:', err.message),
    );
  }

  // ── JWT helper ─────────────────────────────────────────────────────────────
  sign(userId: string, role: string): string {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      // Refuse to sign with a guessable fallback — fail loudly instead.
      throw new Error('JWT_SECRET is not configured (backend/.env)');
    }
    return jwt.sign(
      { sub: userId, role },
      secret,
      { expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '7d' },
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendOtpEmail(email: string, fullName: string, code: string) {
    await this.resend.emails.send({
      from:    this.config.get<string>('RESEND_FROM') ?? 'Jesta <noreply@jesta.co.il>',
      to:      email,
      subject: `קוד האימות שלך: ${code} — Jesta ⚡`,
      html:    verificationEmailHtml({ fullName, code }),
    });
  }
}
