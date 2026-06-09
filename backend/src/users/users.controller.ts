import {
  Controller, Patch, Post, Get,
  Body, Param, Req, Res, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { UsersService }      from './users.service';
import { UpdateProfileDto }  from './dto/update-profile.dto';
import { JwtAuthGuard }      from '../auth/jwt.guard';
import type { JwtPayload }   from '../auth/jwt.guard';

interface AuthedRequest extends Express.Request {
  user: JwtPayload;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * PATCH /api/users/profile
   * Update the authenticated user's fullName, phone, or avatarUrl.
   * Requires Bearer token.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(
    @Req()  req: AuthedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.sub, dto);
  }

  /**
   * POST /api/users/send-verification
   * Generates a token and sends a branded verification email via Resend.
   * Requires Bearer token.
   */
  @UseGuards(JwtAuthGuard)
  @Post('send-verification')
  @HttpCode(HttpStatus.OK)
  sendVerificationEmail(@Req() req: AuthedRequest) {
    return this.usersService.sendVerificationEmail(req.user.sub);
  }

  /**
   * GET /api/users/verify-email/:token
   * Called by clicking the link in the verification email.
   * Marks the user as verified and redirects to the frontend.
   */
  @Get('verify-email/:token')
  async verifyEmail(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const { redirectUrl } = await this.usersService.verifyEmail(token);
    return res.redirect(redirectUrl);
  }
}
