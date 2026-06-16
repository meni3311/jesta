import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';

/**
 * Provides the Stripe SDK wrapper. Exported so PaymentsModule (and any future
 * module needing Stripe) can inject StripeService.
 */
@Module({
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
