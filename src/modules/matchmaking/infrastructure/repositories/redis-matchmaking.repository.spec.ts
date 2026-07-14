import { jest } from '@jest/globals';
import { RedisMatchmakingRepository } from './redis-matchmaking.repository.js';
import { MatchTicket } from '../../domain/entities/match-ticket.entity.js';

describe('RedisMatchmakingRepository', () => {
  let repository: RedisMatchmakingRepository;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      zadd: jest.fn(),
      zrem: jest.fn(),
      zrange: jest.fn(),
      zscore: jest.fn(),
      hset: jest.fn(),
      hdel: jest.fn(),
      hget: jest.fn(),
      hgetall: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
    };
    repository = new RedisMatchmakingRepository(mockRedis);
  });

  it('should add to queue', async () => {
    const joinedAt = new Date('2026-07-14T00:00:00Z');
    mockRedis.zadd.mockResolvedValue(1);
    mockRedis.hset.mockResolvedValue(1);

    await repository.addToQueue('riichi', 'u1', 1200, joinedAt);

    expect(mockRedis.zadd).toHaveBeenCalledWith('matchmaking:queue:riichi', 1200, 'u1');
    expect(mockRedis.hset).toHaveBeenCalledWith('matchmaking:joined-at:riichi', 'u1', joinedAt.getTime().toString());
  });

  it('should remove from queue', async () => {
    mockRedis.zrem.mockResolvedValue(1);
    mockRedis.hdel.mockResolvedValue(1);

    await repository.removeFromQueue('riichi', 'u1');

    expect(mockRedis.zrem).toHaveBeenCalledWith('matchmaking:queue:riichi', 'u1');
    expect(mockRedis.hdel).toHaveBeenCalledWith('matchmaking:joined-at:riichi', 'u1');
  });

  it('should retrieve matchmaking queue', async () => {
    mockRedis.zrange.mockResolvedValue(['u1', 'u2']);
    mockRedis.zscore.mockImplementation(async (key, member) => {
      if (member === 'u1') return '1200';
      if (member === 'u2') return '1300';
      return null;
    });
    mockRedis.hget.mockImplementation(async (key, field) => {
      if (field === 'u1') return '1600000000000';
      if (field === 'u2') return '1600000001000';
      return null;
    });

    const queue = await repository.getQueue('riichi');

    expect(queue).toHaveLength(2);
    expect(queue[0].userId).toBe('u1');
    expect(queue[0].elo).toBe(1200);
    expect(queue[0].joinedAt.getTime()).toBe(1600000000000);
  });

  it('should get joinedAt date', async () => {
    mockRedis.hget.mockResolvedValue('1600000000000');
    const joinedAt = await repository.getJoinedAt('riichi', 'u1');
    expect(joinedAt?.getTime()).toBe(1600000000000);
  });

  it('should return null if joinedAt not found', async () => {
    mockRedis.hget.mockResolvedValue(null);
    const joinedAt = await repository.getJoinedAt('riichi', 'u1');
    expect(joinedAt).toBeNull();
  });

  it('should create a match ticket with 10s TTL', async () => {
    const ticket = new MatchTicket('t1', 'riichi', ['u1', 'u2', 'u3', 'u4'], ['u1'], new Date(1600000000000));
    mockRedis.hset.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    await repository.createTicket(ticket);

    expect(mockRedis.hset).toHaveBeenCalledWith('matchmaking:ticket:t1', {
      id: 't1',
      ruleset: 'riichi',
      players: 'u1,u2,u3,u4',
      acceptedPlayers: 'u1',
      createdAt: '1600000000000',
    });
    expect(mockRedis.expire).toHaveBeenCalledWith('matchmaking:ticket:t1', 10);
  });

  it('should get match ticket', async () => {
    mockRedis.hgetall.mockResolvedValue({
      id: 't1',
      ruleset: 'riichi',
      players: 'u1,u2,u3,u4',
      acceptedPlayers: 'u1,u2',
      createdAt: '1600000000000',
    });

    const ticket = await repository.getTicket('t1');

    expect(ticket).not.toBeNull();
    expect(ticket?.id).toBe('t1');
    expect(ticket?.ruleset).toBe('riichi');
    expect(ticket?.players).toEqual(['u1', 'u2', 'u3', 'u4']);
    expect(ticket?.acceptedPlayers).toEqual(['u1', 'u2']);
    expect(ticket?.createdAt.getTime()).toBe(1600000000000);
  });

  it('should return null if ticket not found', async () => {
    mockRedis.hgetall.mockResolvedValue({});
    const ticket = await repository.getTicket('t1');
    expect(ticket).toBeNull();
  });

  it('should save ticket if it exists', async () => {
    mockRedis.exists.mockResolvedValue(1);
    mockRedis.hset.mockResolvedValue(1);
    const ticket = new MatchTicket('t1', 'riichi', ['u1', 'u2', 'u3', 'u4'], ['u1', 'u2', 'u3'], new Date(1600000000000));

    await repository.saveTicket(ticket);

    expect(mockRedis.hset).toHaveBeenCalledWith('matchmaking:ticket:t1', {
      acceptedPlayers: 'u1,u2,u3',
    });
  });

  it('should not save ticket if it expired', async () => {
    mockRedis.exists.mockResolvedValue(0);

    const ticket = new MatchTicket('t1', 'riichi', ['u1', 'u2', 'u3', 'u4'], ['u1', 'u2', 'u3'], new Date(1600000000000));
    await repository.saveTicket(ticket);

    expect(mockRedis.hset).not.toHaveBeenCalled();
  });

  it('should delete ticket', async () => {
    mockRedis.del.mockResolvedValue(1);
    await repository.deleteTicket('t1');
    expect(mockRedis.del).toHaveBeenCalledWith('matchmaking:ticket:t1');
  });
});
