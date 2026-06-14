import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Untyped escape hatch for model access (`prisma.db.<model>`).
   *
   * IMPORTANT: this must be a property assigned in the constructor, NOT a
   * getter. Prisma's constructor returns a Proxy that provides the model
   * accessors (job, user, notification, ...), and its `get` trap reads
   * plain properties off the raw target — so a getter would run with
   * `this` = the raw client, which has no models, making every
   * `db.<model>` undefined at runtime.
   */
  public readonly db: any;

  constructor() {
    // Prisma 7 requires a driver adapter — connection URLs are no longer
    // passed directly to the constructor.
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    });
    super({
      adapter,
      log: ['info', 'warn', 'error'],
    } as any);
    // After super(), `this` IS the proxied client Prisma returned.
    this.db = this;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✓ Database connected');
    } catch (err) {
      this.logger.error(
        '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        ' DB connection failed — API still starting.\n' +
        ' Check backend/.env  (see .env.example for help).\n' +
        ' Error: ' + (err as Error).message + '\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
