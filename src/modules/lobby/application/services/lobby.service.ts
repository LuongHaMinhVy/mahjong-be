import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { IRoomRepository } from '../../../room/domain/repositories/room.repository.js';

@Injectable()
export class LobbyService {
  private readonly onlineKey = 'mahjong:online';

  constructor(
    @Inject('REDIS') private readonly redis: Redis,
    @Inject(IRoomRepository) private readonly roomRepository: IRoomRepository,
  ) {}

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

  async getRoomsByRuleset(ruleset: 'riichi' | 'chinese'): Promise<any[]> {
    const rooms = await this.roomRepository.findAllWaiting();
    return rooms.filter((room) => room.ruleset === ruleset);
  }
}
