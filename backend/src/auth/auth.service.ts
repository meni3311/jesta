import {
  Injectable, ConflictException, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto }   from './dto/register.dto';
import { LoginDto }      from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as jwt    from 'jsonwebtoken';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
  ) {}

  // ── Register ───────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role:     dto.role,
        phone:    dto.phone,
      },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    });

    return { user, token: this.sign(user.id, user.role) };
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return {
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      token: this.sign(user.id, user.role),
    };
  }

  // ── JWT helper ────────────────────────────────────────────────────────────
  private sign(userId: string, role: string): string {
    return jwt.sign(
      { sub: userId, role },
      this.config.get<string>('JWT_SECRET') ?? 'dev-secret',
      { expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '7d' },
    );
  }
}
