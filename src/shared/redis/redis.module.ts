import { Global, Logger, Module } from '@nestjs/common';
import { Redis } from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      useFactory: () => {
        const logger = new Logger('RedisModule');

        const redisUrl = process.env.REDIS_URL;

        const client = redisUrl
          ? new Redis(redisUrl, {
              maxRetriesPerRequest: null,
              tls: redisUrl.startsWith('rediss://')
                ? { rejectUnauthorized: false }
                : undefined,
            })
          : new Redis({
              host: process.env.REDIS_HOST,
              port: Number(process.env.REDIS_PORT ?? 6379),
              username: process.env.REDIS_USERNAME,
              password: process.env.REDIS_PASSWORD,
              tls:
                process.env.REDIS_TLS === 'true'
                  ? { rejectUnauthorized: false }
                  : undefined,
              maxRetriesPerRequest: null,
            });

        client.on('connect', () => logger.log('Redis connected'));
        client.on('ready', () => logger.log('Redis ready'));
        client.on('error', (err: Error) =>
          logger.error(`Redis error: ${err.message}`),
        );
        client.on('close', () => logger.warn('Redis connection closed'));

        return client;
      },
    },
  ],
  exports: ['REDIS'],
})
export class RedisModule {}
