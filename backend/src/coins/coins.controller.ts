import {
  Controller, Get, Post, Body, UseGuards, Req,
} from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { CoinsService } from './coins.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

class ApplyReferralDto {
  @IsString()
  @Length(4, 16)
  code!: string;
}

@Controller('coins')
export class CoinsController {
  constructor(private readonly coins: CoinsService) {}

  // GET /api/coins/packages — the purchasable bundles (Starter…Business)
  @UseGuards(JwtAuthGuard)
  @Get('packages')
  getPackages() {
    return this.coins.getPackages();
  }

  // GET /api/coins/wallet — balance + Pro status for the dashboard
  @UseGuards(JwtAuthGuard)
  @Get('wallet')
  getWallet(@Req() req: any) {
    return this.coins.getWallet(req.user.sub);
  }

  // GET /api/coins/transactions — the employer's coin ledger
  @UseGuards(JwtAuthGuard)
  @Get('transactions')
  getTransactions(@Req() req: any) {
    return this.coins.getTransactions(req.user.sub);
  }

  // GET /api/coins/referral — own referral code + payout stats
  @UseGuards(JwtAuthGuard)
  @Get('referral')
  getReferral(@Req() req: any) {
    return this.coins.getReferralInfo(req.user.sub);
  }

  // POST /api/coins/referral/apply — link a friend's referral code
  @UseGuards(JwtAuthGuard)
  @Post('referral/apply')
  applyReferral(@Req() req: any, @Body() dto: ApplyReferralDto) {
    return this.coins.applyReferralCode(req.user.sub, dto.code);
  }
}
