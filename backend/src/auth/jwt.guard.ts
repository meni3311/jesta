import {
  Injectable, CanActivate, ExecutionContext, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub:  string;   // userId
  role: string;
  iat:  number;
  exp:  number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req  = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'] as string | undefined;

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token  = auth.split(' ')[1];
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      // Never verify against a guessable fallback secret
      throw new UnauthorizedException('Server auth misconfigured (JWT_SECRET missing)');
    }

    try {
      req.user = jwt.verify(token, secret) as JwtPayload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
