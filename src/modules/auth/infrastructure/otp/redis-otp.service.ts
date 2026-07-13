import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisOtpService {
  constructor(@Inject('REDIS') private readonly redis: Redis) {}

  async generateOtp(userId: string): Promise<string> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const key = `otp:${userId}`;
    await this.redis.set(key, otp, 'EX', 300); // 5 minutes TTL
    return otp;
  }

  async verifyOtp(userId: string, otp: string): Promise<boolean> {
    const key = `otp:${userId}`;
    const storedOtp = await this.redis.get(key);
    if (storedOtp === otp) {
      await this.redis.del(key);
      return true;
    }
    return false;
  }

  async checkRateLimit(userId: string): Promise<boolean> {
    const key = `otp_limit:${userId}`;
    const count = await this.redis.get(key);
    if (count && parseInt(count, 10) >= 3) {
      return false;
    }
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, 900); // 15 minutes limit
    await pipeline.exec();
    return true;
  }
}
