/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Room } from '../../domain/entities/room.entity.js';
import { RoomPlayer } from '../../domain/value-objects/room-player.vo.js';
import { IRoomRepository } from '../../domain/repositories/room.repository.js';

@Injectable()
export class RedisRoomRepository implements IRoomRepository {
  private readonly prefix = 'mahjong:room:';
  private readonly activeSetKey = 'mahjong:rooms:active';

  constructor(@Inject('REDIS') private readonly redis: Redis) {}

  async save(room: Room): Promise<void> {
    const key = `${this.prefix}${room.id}`;
    // Serialization
    const data = JSON.stringify({
      id: room.id,
      name: room.name,
      hostId: room.hostId,
      ruleset: room.ruleset,
      status: room.status,
      players: room.players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        avatar: p.avatar,
        elo: p.elo,
        isReady: p.isReady,
      })),
    });

    await this.redis.set(key, data);
    await this.redis.sadd(this.activeSetKey, room.id);
  }

  async findById(id: string): Promise<Room | null> {
    const key = `${this.prefix}${id}`;
    const data = await this.redis.get(key);
    if (!data) return null;

    try {
      const raw = JSON.parse(data);
      return this.reconstructRoom(raw);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    const key = `${this.prefix}${id}`;
    await this.redis.del(key);
    await this.redis.srem(this.activeSetKey, id);
  }

  async findAllWaiting(): Promise<Room[]> {
    const ids = await this.redis.smembers(this.activeSetKey);
    if (!ids || ids.length === 0) return [];

    const rooms: Room[] = [];
    for (const id of ids) {
      const room = await this.findById(id);
      if (room && room.status === 'waiting') {
        rooms.push(room);
      }
    }
    return rooms;
  }

  private reconstructRoom(raw: any): Room {
    const players = (raw.players || []).map(
      (p: any) =>
        new RoomPlayer(p.userId, p.displayName, p.avatar, p.elo, p.isReady),
    );

    return new Room(
      raw.id,
      raw.name,
      raw.hostId,
      raw.ruleset,
      raw.status,
      players,
    );
  }
}
