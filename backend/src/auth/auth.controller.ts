import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService }     from './auth.service';
import { RegisterDto }     from './dto/register.dto';
import { LoginDto }        from './dto/login.dto';
import { VerifyEmailDto }  from './dto/verify-email.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/register
   * Creates account, sends 6-digit OTP, returns { pendingVerification, email }.
   * No token yet — the client must call /auth/verify-email to get one.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /api/auth/verify-email
   * Body: { email, code }
   * Validates OTP → marks user verified → returns { user, token }.
   * The client saves this session and the user is immediately logged in.
   */
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmailAndLogin(dto);
  }

  /**
   * POST /api/auth/login
   * Validates credentials and returns { user, token }.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
