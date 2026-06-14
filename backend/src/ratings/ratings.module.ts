import { Module } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';
import { ScoreModule } from '../score/score.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [ScoreModule, NotificationsModule],
  controllers: [RatingsController],
  providers:   [RatingsService],
  exports:     [RatingsService],
})
export class RatingsModule {}
