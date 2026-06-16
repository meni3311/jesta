import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeModule } from '../stripe/stripe.module';
import { CoinsModule } from '../coins/coins.module';

/**
 * Stripe-facing module: coin-package PaymentIntents, the Pro subscription, and
 * the webhook that credits coins / flips Pro status. Depends on StripeModule
 * (SDK wrapper) and CoinsModule (wallet credits).
 */
@Module({
  imports: [StripeModule, CoinsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
