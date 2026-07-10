import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST,
          username: process.env.REDIS_USERNAME,
          port: Number(process.env.REDIS_PORT),
          password: process.env.REDIS_PASSWORD,
        });
      },
    },
  ],
  exports: ['REDIS'],
})
export class RedisModule {}
