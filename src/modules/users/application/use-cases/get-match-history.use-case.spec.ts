import { jest } from '@jest/globals';
import { GetMatchHistoryUseCase } from './get-match-history.use-case.js';
import { type IUserStatsRepository } from '../../domain/repositories/user-stats.repository.js';
import { GameResult } from '../../../mahjong/domain/entities/game-result.entity.js';

describe('GetMatchHistoryUseCase', () => {
  let useCase: GetMatchHistoryUseCase;
  let mockUserStatsRepo: jest.Mocked<IUserStatsRepository>;

  beforeEach(() => {
    mockUserStatsRepo = {
      getStats: jest.fn(),
      getMatchHistory: jest.fn(),
    } as any;

    useCase = new GetMatchHistoryUseCase(mockUserStatsRepo);
  });

  it('should call getMatchHistory on repository with correct params', async () => {
    const mockResults: GameResult[] = [
      new GameResult(
        'game-1',
        'room-1',
        'riichi',
        'user-123',
        [
          {
            userId: 'user-123',
            displayName: 'User 123',
            score: 30000,
            pointChange: 15,
            isWinner: true,
          },
        ],
        new Date(),
      ),
    ];

    mockUserStatsRepo.getMatchHistory.mockResolvedValue(mockResults);

    const result = await useCase.execute('user-123', { limit: 10, offset: 0 });

    expect(mockUserStatsRepo.getMatchHistory).toHaveBeenCalledWith(
      'user-123',
      10,
      0,
    );
    expect(result).toEqual(mockResults);
  });
});
