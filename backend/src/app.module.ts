import { Module }      from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { JobsModule }   from './jobs/jobs.module';
import { AuthModule }   from './auth/auth.module';
import { UsersModule }  from './users/users.module';
import { ChatModule }   from './chat/chat.module';
import { ScoreModule }         from './score/score.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RatingsModule }       from './ratings/ratings.module';
import { OffersModule }        from './offers/offers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    JobsModule,
    AuthModule,
    UsersModule,
    ChatModule,
    ScoreModule,
    NotificationsModule,
    RatingsModule,
    OffersModule,
  ],
})
export class AppModule {}
