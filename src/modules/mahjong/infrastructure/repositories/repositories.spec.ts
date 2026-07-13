/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { jest } from '@jest/globals';
import { RedisGameStateRepository } from './redis-game-state.repository.js';
import { PrismaGameResultRepository } from './prisma-game-result.repository.js';
import { GameState } from '../../domain/entities/game-state.entity.js';
import { GameResult } from '../../domain/entities/game-result.entity.js';
import { Tile } from '../../domain/value-objects/tile.vo.js';
import { type Redis } from 'ioredis';

describe('Mahjong Repositories', () => {
  describe('RedisGameStateRepository', () => {
    let mockRedis: jest.Mocked<Redis>;
    let repo: RedisGameStateRepository;

    beforeEach(() => {
      mockRedis = {
        setex: jest.fn().mockResolvedValue('OK'),
        get: jest.fn(),
        del: jest.fn().mockResolvedValue(1),
      };

      repo = new RedisGameStateRepository(mockRedis);
    });

    it('should save game state to redis', async () => {
      const state = new GameState(
        'g1',
        'room1',
        'riichi',
        'playing',
        [],
        0,
        [],
      );
      await repo.save(state);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'mahjong:game:g1',
        86400,
        expect.any(String),
      );
    });

    it('should retrieve and reconstruct game state from redis', async () => {
      const mockStateJson = JSON.stringify({
        id: 'g1',
        roomId: 'room1',
        rulesetName: 'riichi',
        phase: 'playing',
        wall: [{ suit: 'man', value: 1, type: 'number', id: 't1' }],
        currentTurn: 0,
        players: [
          {
            userId: 'u1',
            hand: [{ suit: 'man', value: 2, type: 'number', id: 't2' }],
            melds: [],
            discards: [],
            score: 25000,
            isRiichi: false,
          },
        ],
      });

      mockRedis.get.mockResolvedValue(mockStateJson);

      const state = await repo.findById('g1');
      expect(state).not.toBeNull();
      expect(state?.id).toBe('g1');
      expect(state?.wall[0]).toBeInstanceOf(Tile);
      expect(state?.players[0].hand[0]).toBeInstanceOf(Tile);
    });
  });

  describe('PrismaGameResultRepository', () => {
    let mockPrisma: any;
    let repo: PrismaGameResultRepository;

    beforeEach(() => {
      mockPrisma = {
        gameResult: {
          create: jest.fn().mockResolvedValue({}),
          findUnique: jest.fn(),
          findMany: jest.fn(),
        },
      };
      repo = new PrismaGameResultRepository(mockPrisma);
    });

    it('should save game result to prisma', async () => {
      const result = new GameResult(
        'res1',
        'room1',
        'riichi',
        'u1',
        [],
        new Date(),
      );
      await repo.save(result);

      expect(mockPrisma.gameResult.create).toHaveBeenCalledWith({
        data: {
          id: 'res1',
          roomId: 'room1',
          rulesetName: 'riichi',
          winnerId: 'u1',
          playersJson: [],
          createdAt: expect.any(Date),
        },
      });
    });
  });
});
