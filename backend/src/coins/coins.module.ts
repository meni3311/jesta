import { Module } from '@nestjs/common';
import { CoinsService } from './coins.service';
import { CoinsController } from './coins.controller';

/**
 * Owns the coin wallet: catalog, ledger, job-fill charging, the free-tier
 * weekly posting limit and the referral program. Exports CoinsService so
 * JobsModule (charge on arrival / weekly limit / referral payout) and
 * PaymentsModule (credit purchases) can use it.
 */
@Module({
  controllers: [CoinsController],
  providers: [CoinsService],
  exports: [CoinsService],
})
export class CoinsModule {}
