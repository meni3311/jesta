import {
  Controller, Post, Body, Req, Headers, UseGuards,
  HttpCode, HttpStatus, BadRequestException, RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // POST /api/payments/create-payment-intent — buy a coin package
  @UseGuards(JwtAuthGuard)
  @Post('create-payment-intent')
  @HttpCode(HttpStatus.OK)
  createPaymentIntent(@Req() req: any, @Body() dto: CreatePaymentIntentDto) {
    return this.payments.createPaymentIntent(req.user.sub, dto.packageId);
  }

  // POST /api/payments/create-subscription — start Pro (₪199/mo)
  @UseGuards(JwtAuthGuard)
  @Post('create-subscription')
  @HttpCode(HttpStatus.OK)
  createSubscription(@Req() req: any) {
    return this.payments.createSubscription(req.user.sub);
  }

  // POST /api/payments/cancel-subscription — cancel Pro at period end
  @UseGuards(JwtAuthGuard)
  @Post('cancel-subscription')
  @HttpCode(HttpStatus.OK)
  cancelSubscription(@Req() req: any) {
    return this.payments.cancelSubscription(req.user.sub);
  }

  // POST /api/payments/webhook — Stripe events (NO auth; verified by signature)
  // Requires the RAW request body for signature verification — enabled via
  // `NestFactory.create(AppModule, { rawBody: true })` in main.ts.
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) throw new BadRequestException('Missing stripe-signature header');
    if (!req.rawBody) throw new BadRequestException('Missing raw request body');
    return this.payments.handleWebhook(req.rawBody, signature);
  }
}
