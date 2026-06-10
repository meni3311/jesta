import {
  Controller, Patch, Post, Get,
  Body, Param, Req, Res, UseGuards,
  HttpCode, HttpStatus,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor }   from '@nestjs/platform-express';
import { memoryStorage }     from 'multer';
import { Response }          from 'express';
import { UsersService }      from './users.service';
import { UpdateProfileDto }  from './dto/update-profile.dto';
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
}
