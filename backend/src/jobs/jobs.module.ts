import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService }    from './jobs.service';
import { ScoreModule }    from '../score/score.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [ScoreModule, NotificationsModule],
  controllers: [JobsController],
  providers:   [JobsService],
  exports:     [JobsService],
})
export class JobsModule {}
