import { jest } from '@jest/globals';
import { RedisRoomRepository } from './redis-room.repository.js';
import { Room } from '../../domain/entities/room.entity.js';
import { RoomPlayer } from '../../domain/value-objects/room-player.vo.js';
import { type Redis } from 'ioredis';

describe('RedisRoomRepository', () => {
  let repository: RedisRoomRepository;
  let mockRedis: any;

  beforeEach(() => {
    const store = new Map<string, string>();
    const sets = new Map<string, Set<string>>();

    mockRedis = {
      set: jest.fn(async (key: string, val: string) => {
        store.set(key, val);
      }),
      get: jest.fn(async (key: string) => {
        return store.get(key) || null;
      }),
      del: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      sadd: jest.fn(async (key: string, member: string) => {
        if (!sets.has(key)) sets.set(key, new Set());
        sets.get(key)!.add(member);
      }),
      srem: jest.fn(async (key: string, member: string) => {
        sets.get(key)?.delete(member);
      }),
      smembers: jest.fn(async (key: string) => {
        const set = sets.get(key);
        return set ? Array.from(set) : [];
      }),
    };

    repository = new RedisRoomRepository(mockRedis);
  });

  it('should save and find a room by id', async () => {
    const room = new Room('r-1', 'Test Room', 'u-1', 'riichi', 'waiting', [
      new RoomPlayer('u-1', 'Host', null, 1000, false),
    ]);

    await repository.save(room);
    expect(mockRedis.set).toHaveBeenCalled();
    expect(mockRedis.sadd).toHaveBeenCalledWith('mahjong:rooms:active', 'r-1');

    const found = await repository.findById('r-1');
    expect(found).toBeDefined();
    expect(found?.id).toBe('r-1');
    expect(found?.name).toBe('Test Room');
    expect(found?.hostId).toBe('u-1');
    expect(found?.players[0].userId).toBe('u-1');
  });

  it('should return null if room not found', async () => {
    const found = await repository.findById('non-existent');
    expect(found).toBeNull();
  });

  it('should delete a room correctly', async () => {
    const room = new Room('r-1', 'Test Room', 'u-1', 'riichi', 'waiting', [
      new RoomPlayer('u-1', 'Host', null, 1000, false),
    ]);

    await repository.save(room);
    await repository.delete('r-1');

    expect(mockRedis.del).toHaveBeenCalledWith('mahjong:room:r-1');
    expect(mockRedis.srem).toHaveBeenCalledWith('mahjong:rooms:active', 'r-1');

    const found = await repository.findById('r-1');
    expect(found).toBeNull();
  });

  it('should find all waiting rooms', async () => {
    const room1 = new Room('r-1', 'Room 1', 'u-1', 'riichi', 'waiting', [
      new RoomPlayer('u-1', 'Host 1', null, 1000, false),
    ]);
    const room2 = new Room('r-2', 'Room 2', 'u-2', 'chinese', 'playing', [
      new RoomPlayer('u-2', 'Host 2', null, 1000, false),
    ]);

    await repository.save(room1);
    await repository.save(room2);

    const waiting = await repository.findAllWaiting();
    expect(waiting.length).toBe(1);
    expect(waiting[0].id).toBe('r-1');
  });
});
