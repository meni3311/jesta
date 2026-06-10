import { Module }      from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { JobsModule }   from './jobs/jobs.module';
import { AuthModule }   from './auth/auth.module';
import { UsersModule }  from './users/users.module';
import { ChatModule }   from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    JobsModule,
    AuthModule,
    UsersModule,
    ChatModule,
  ],
})
export class AppModule {}
