import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Clean all data from database (useful for testing)
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('This method is only allowed in test environment');
    }

    const modelKeys = Object.keys(this).filter(
      (key) => !key.startsWith('_') && !key.startsWith('$'),
    );

    for (const modelKey of modelKeys) {
      const model = this[modelKey as keyof this];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (model && typeof (model as any).deleteMany === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (model as any).deleteMany();
      }
    }
  }
}
