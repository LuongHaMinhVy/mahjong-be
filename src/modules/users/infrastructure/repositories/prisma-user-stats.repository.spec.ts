import { jest } from '@jest/globals';
import { PrismaUserStatsRepository } from './prisma-user-stats.repository.js';
import { type PrismaService } from '../../../../shared/database/prisma.service.js';

describe('PrismaUserStatsRepository', () => {
  let repository: PrismaUserStatsRepository;
  let mockPrisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      gameResult: {
        findMany: jest.fn(),
      },
    } as any;

    repository = new PrismaUserStatsRepository(mockPrisma);
  });

  describe('getStats', () => {
    it('should throw if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(repository.getStats('invalid')).rejects.toThrow(
        'User not found',
      );
    });

    it('should compute stats correctly', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        elo: 1100,
      } as any);
      mockPrisma.gameResult.findMany.mockResolvedValue([
        {
          id: 'g1',
          roomId: 'r1',
          rulesetName: 'riichi',
          winnerId: 'user-123',
          playersJson: [{ userId: 'user-123', isWinner: true }],
          createdAt: new Date(),
        },
        {
          id: 'g2',
          roomId: 'r1',
          rulesetName: 'riichi',
          winnerId: 'user-456',
          playersJson: [{ userId: 'user-123', isWinner: false }],
          createdAt: new Date(),
        },
      ] as any);

      const stats = await repository.getStats('user-123');

      expect(stats.totalGames).toBe(2);
      expect(stats.wins).toBe(1);
      expect(stats.winRate).toBe(0.5);
      expect(stats.currentElo).toBe(1100);
    });
  });

  describe('getMatchHistory', () => {
    it('should query gameResults with offset and limit', async () => {
      mockPrisma.gameResult.findMany.mockResolvedValue([]);

      await repository.getMatchHistory('user-123', 10, 5);

      expect(mockPrisma.gameResult.findMany).toHaveBeenCalledWith({
        where: {
          playersJson: {
            path: [],
            array_contains: [{ userId: 'user-123' }],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
        skip: 5,
      });
    });
  });
});
