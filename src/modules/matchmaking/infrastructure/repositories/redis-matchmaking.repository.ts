import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';
import { MatchmakingQueueEntry } from '../../domain/value-objects/queue-entry.vo.js';
import { MatchTicket } from '../../domain/entities/match-ticket.entity.js';

@Injectable()
export class RedisMatchmakingRepository implements IMatchmakingRepository {
  constructor(@Inject('REDIS') private readonly redis: Redis) {}

  async addToQueue(ruleset: 'riichi' | 'chinese', userId: string, elo: number, joinedAt: Date): Promise<void> {
    await Promise.all([
      this.redis.zadd(`matchmaking:queue:${ruleset}`, elo, userId),
      this.redis.hset(`matchmaking:joined-at:${ruleset}`, userId, joinedAt.getTime().toString()),
    ]);
  }

  async removeFromQueue(ruleset: 'riichi' | 'chinese', userId: string): Promise<void> {
    await Promise.all([
      this.redis.zrem(`matchmaking:queue:${ruleset}`, userId),
      this.redis.hdel(`matchmaking:joined-at:${ruleset}`, userId),
    ]);
  }

  async getQueue(ruleset: 'riichi' | 'chinese'): Promise<MatchmakingQueueEntry[]> {
    const userIds = await this.redis.zrange(`matchmaking:queue:${ruleset}`, 0, -1);
    if (userIds.length === 0) return [];

    const entries = await Promise.all(
      userIds.map(async (userId) => {
        const eloStr = await this.redis.zscore(`matchmaking:queue:${ruleset}`, userId);
        const joinedAtStr = await this.redis.hget(`matchmaking:joined-at:${ruleset}`, userId);
        const elo = eloStr ? parseInt(eloStr, 10) : 1000;
        const joinedAt = joinedAtStr ? new Date(parseInt(joinedAtStr, 10)) : new Date();
        return new MatchmakingQueueEntry(userId, elo, joinedAt);
      })
    );
    return entries;
  }

  async getJoinedAt(ruleset: 'riichi' | 'chinese', userId: string): Promise<Date | null> {
    const joinedAtStr = await this.redis.hget(`matchmaking:joined-at:${ruleset}`, userId);
    return joinedAtStr ? new Date(parseInt(joinedAtStr, 10)) : null;
  }

  async createTicket(ticket: MatchTicket): Promise<void> {
    const key = `matchmaking:ticket:${ticket.id}`;
    await this.redis.hset(key, {
      id: ticket.id,
      ruleset: ticket.ruleset,
      players: ticket.players.join(','),
      acceptedPlayers: ticket.acceptedPlayers.join(','),
      createdAt: ticket.createdAt.getTime().toString(),
    });
    await this.redis.expire(key, 10);
  }

  async getTicket(ticketId: string): Promise<MatchTicket | null> {
    const key = `matchmaking:ticket:${ticketId}`;
    const data = await this.redis.hgetall(key);
    if (!data || !data.id) return null;

    return new MatchTicket(
      data.id,
      data.ruleset as 'riichi' | 'chinese',
      data.players ? data.players.split(',') : [],
      data.acceptedPlayers ? data.acceptedPlayers.split(',').filter(Boolean) : [],
      new Date(parseInt(data.createdAt, 10))
    );
  }

  async saveTicket(ticket: MatchTicket): Promise<void> {
    const key = `matchmaking:ticket:${ticket.id}`;
    const exists = await this.redis.exists(key);
    if (!exists) return;

    await this.redis.hset(key, {
      acceptedPlayers: ticket.acceptedPlayers.join(','),
    });
  }

  async deleteTicket(ticketId: string): Promise<void> {
    await this.redis.del(`matchmaking:ticket:${ticketId}`);
  }
}
