import { jest } from '@jest/globals';
import { GetLeaderboardUseCase } from './get-leaderboard.use-case.js';
import { type ILeaderboardRepository } from '../../domain/repositories/leaderboard.repository.js';
import { LeaderboardEntry } from '../../domain/value-objects/leaderboard-entry.vo.js';
import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { User } from '../../../auth/domain/user.entity.js';

import { Email } from '../../../auth/domain/value-objects/email.vo.js';
import { Password } from '../../../auth/domain/value-objects/password.vo.js';

describe('GetLeaderboardUseCase', () => {
  let useCase: GetLeaderboardUseCase;
  let mockLeaderboardRepo: jest.Mocked<ILeaderboardRepository>;
  let mockUserRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockLeaderboardRepo = {
      getGlobalRankings: jest.fn(),
      getUserRank: jest.fn(),
      getUserStats: jest.fn(),
    } as any;

    mockUserRepo = {
      findById: jest.fn(),
    } as any;

    useCase = new GetLeaderboardUseCase(mockLeaderboardRepo, mockUserRepo);
  });

  it('should return paginated leaderboard and current user rank', async () => {
    const mockUser = new User({
      id: 'my-id',
      email: new Email('test@test.com'),
      password: Password.create('Password123!'),
      displayName: 'Me',
      avatar: null,
      elo: 1100,
      isEmailVerified: true,
    });
    mockUserRepo.findById.mockResolvedValue(mockUser);
    
    mockLeaderboardRepo.getGlobalRankings.mockResolvedValue({
      entries: [new LeaderboardEntry('1', 'P1', null, 1200, 10, 5)],
      total: 100,
    });
    mockLeaderboardRepo.getUserRank.mockResolvedValue(12);
    mockLeaderboardRepo.getUserStats.mockResolvedValue({ totalGames: 4, wins: 2 });

    const result = await useCase.execute({ userId: 'my-id', page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(100);
    expect(result.currentUserRank).toEqual({
      rank: 12,
      userId: 'my-id',
      displayName: 'Me',
      avatar: null,
      elo: 1100,
      stats: {
        totalGames: 4,
        wins: 2,
        winRate: 0.5,
      },
    });
  });
});
