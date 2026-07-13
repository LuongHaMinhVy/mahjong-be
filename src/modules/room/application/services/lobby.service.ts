import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CreateRoomUseCase } from '../use-cases/create-room.use-case.js';
import { JoinRoomUseCase } from '../use-cases/join-room.use-case.js';
import { Room } from '../../domain/entities/room.entity.js';

@Injectable()
export class LobbyService {
  private readonly onlineKey = 'mahjong:online';
  private readonly queueKey = 'mahjong:queue';

  constructor(
    @Inject('REDIS') private readonly redis: Redis,
    private readonly createRoomUseCase: CreateRoomUseCase,
    private readonly joinRoomUseCase: JoinRoomUseCase,
  ) {}

  async setUserOnline(userId: string): Promise<void> {
    await this.redis.sadd(this.onlineKey, userId);
  }

  async setUserOffline(userId: string): Promise<void> {
    await this.redis.srem(this.onlineKey, userId);
    // Also remove from queue if they go offline
    await this.leaveQueue(userId);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const res = await this.redis.sismember(this.onlineKey, userId);
    return res === 1;
  }

  async getOnlineCount(): Promise<number> {
    return this.redis.scard(this.onlineKey);
  }

  async joinQueue(userId: string): Promise<Room | null> {
    await this.redis.sadd(this.queueKey, userId);
    return this.checkMatchmaking();
  }

  async leaveQueue(userId: string): Promise<void> {
    await this.redis.srem(this.queueKey, userId);
  }

  async getQueue(): Promise<string[]> {
    return this.redis.smembers(this.queueKey);
  }

  private async checkMatchmaking(): Promise<Room | null> {
    const queue = await this.redis.smembers(this.queueKey);
    if (queue.length >= 4) {
      // Form a match with first 4 players
      const players = queue.slice(0, 4);

      // Remove from queue
      for (const p of players) {
        await this.redis.srem(this.queueKey, p);
      }

      // Host is the first player
      const hostId = players[0];
      const room = await this.createRoomUseCase.execute({
        hostId,
        name: `Match-${Math.floor(1000 + Math.random() * 9000)}`,
        ruleset: 'riichi',
      });

      // Join the other 3 players
      for (let i = 1; i < players.length; i++) {
        await this.joinRoomUseCase.execute({
          userId: players[i],
          roomId: room.id,
        });
      }

      return room;
    }
    return null;
  }
}
