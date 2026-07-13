import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { Redis } from 'ioredis';
import crypto from 'crypto';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS') private readonly redis: Redis,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async createSession(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    const tokenHash = this.hashToken(token);
    const ttlSeconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );

    // Save in Redis for fast access
    await this.redis.set(`session:${tokenHash}`, userId, 'EX', ttlSeconds);

    // Save in PostgreSQL for audit log
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async validateSession(token: string): Promise<string | null> {
    const tokenHash = this.hashToken(token);

    // 1. Redis lookup
    const userId = await this.redis.get(`session:${tokenHash}`);
    if (userId) return userId;

    // 2. DB fallback (if Redis cache expired/evicted)
    const session = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (session && session.expiresAt > new Date() && !session.revokedAt) {
      // Re-populate Redis
      const ttlSeconds = Math.max(
        0,
        Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
      );
      await this.redis.set(
        `session:${tokenHash}`,
        session.userId,
        'EX',
        ttlSeconds,
      );
      return session.userId;
    }

    return null;
  }

  async revokeSession(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);

    // Delete from Redis
    await this.redis.del(`session:${tokenHash}`);

    // Update in Postgres
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }
}
