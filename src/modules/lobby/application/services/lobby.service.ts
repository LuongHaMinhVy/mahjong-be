import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class LobbyService {
  private readonly onlineKey = 'mahjong:online';

  constructor(@Inject('REDIS') private readonly redis: Redis) {}

  async setUserOnline(userId: string): Promise<void> {
    await this.redis.sadd(this.onlineKey, userId);
  }

  async setUserOffline(userId: string): Promise<void> {
    await this.redis.srem(this.onlineKey, userId);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const res = await this.redis.sismember(this.onlineKey, userId);
    return res === 1;
  }

  async getOnlineCount(): Promise<number> {
    return this.redis.scard(this.onlineKey);
  }
}
