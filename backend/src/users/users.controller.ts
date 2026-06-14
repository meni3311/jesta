import {
  Controller, Patch, Post, Put, Get,
  Body, Param, Query, Req, Res, UseGuards,
  HttpCode, HttpStatus,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor }   from '@nestjs/platform-express';
import { memoryStorage }     from 'multer';
import { Response }          from 'express';
import { UsersService }      from './users.service';
import { UpdateProfileDto }  from './dto/update-profile.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpsertAvailabilityDto } from './dto/upsert-availability.dto';
import { JwtAuthGuard }      from '../auth/jwt.guard';
import type { JwtPayload }   from '../auth/jwt.guard';

interface AuthedRequest extends Express.Request {
  user: JwtPayload;
}

/** Minimal Multer file shape (avoids requiring @types/multer) */
interface UploadedMulterFile {
  fieldname:    string;
  originalname: string;
  encoding:     string;
  mimetype:     string;
  size:         number;
  buffer:       Buffer;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/users/me
   * Fresh full profile (jestaScore, isPro, flags, availability).
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: AuthedRequest) {
    return this.usersService.getMe(req.user.sub);
  }

  /**
   * GET /api/users/available-workers?jobId=
   * Pro-only: workers who opened their availability profile, by Jesta Score.
   * With ?jobId= the list is matched against that job (time overlap, wage,
   * categories) and each card carries `matchingSlots` for highlighting.
   * Must be declared BEFORE :id/public so the path isn't matched as an id.
   */
  @UseGuards(JwtAuthGuard)
  @Get('available-workers')
  getAvailableWorkers(@Req() req: AuthedRequest, @Query('jobId') jobId?: string) {
    return this.usersService.getAvailableWorkers(req.user.sub, jobId || undefined);
  }

  /**
   * GET /api/users/availability
   * The worker's own availability profile (weekly grid + preferences).
   */
  @UseGuards(JwtAuthGuard)
  @Get('availability')
  getMyAvailability(@Req() req: AuthedRequest) {
    return this.usersService.getMyAvailability(req.user.sub);
  }

  /**
   * PUT /api/users/availability
   * Replace the worker's full availability profile (System 2): weekly grid
   * slots, minimum wage, category preferences, open-to-direct-offers toggle.
   */
  @UseGuards(JwtAuthGuard)
  @Put('availability')
  upsertAvailability(@Req() req: AuthedRequest, @Body() dto: UpsertAvailabilityDto) {
    return this.usersService.upsertAvailability(req.user.sub, req.user.role, dto);
  }

  /**
   * PATCH /api/users/availability  (legacy jsonb profile — kept for the old
   * profile-settings card; the weekly grid uses PUT above)
   */
  @UseGuards(JwtAuthGuard)
  @Patch('availability')
  updateAvailability(@Req() req: AuthedRequest, @Body() dto: UpdateAvailabilityDto) {
    return this.usersService.updateAvailability(req.user.sub, req.user.role, dto);
  }

  /**
   * PATCH /api/users/dev/pro-toggle
   * DEV ONLY (blocked in production): simulate Pro status for testing.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('dev/pro-toggle')
  toggleProDev(@Req() req: AuthedRequest) {
    return this.usersService.toggleProDev(req.user.sub);
  }

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
   * POST /api/users/avatar
   * Upload a profile picture as multipart/form-data (field name: "file").
   * Uploads to Supabase "avatars" bucket, saves public URL to users table.
   * Returns the full updated user object.
   * Requires Bearer token.
   */
  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },   // 5 MB
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new BadRequestException('Only image files are accepted'), false);
      }
      cb(null, true);
    },
  }))
  uploadAvatar(
    @Req()          req:  AuthedRequest,
    @UploadedFile() file: UploadedMulterFile,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.usersService.uploadAvatar(req.user.sub, file);
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

  /**
   * GET /api/users/:id/public
   * Public profile: rating + count + Jesta Score + recent ratings.
   */
  @Get(':id/public')
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
