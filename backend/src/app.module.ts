import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { JobsModule }   from './jobs/jobs.module';
import { AuthModule }   from './auth/auth.module';
import { UsersModule }  from './users/users.module';

@Module({
  imports: [
    // ── Config — loads .env automatically, available globally ───────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ── Database ─────────────────────────────────────────────────────────────
    PrismaModule,

    // ── Feature modules ───────────────────────────────────────────────────────
    JobsModule,
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
