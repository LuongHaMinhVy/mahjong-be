import { jest } from '@jest/globals';
import { LeaderboardController } from './leaderboard.controller.js';
import { type GetLeaderboardUseCase } from '../../application/use-cases/get-leaderboard.use-case.js';

describe('LeaderboardController', () => {
  let controller: LeaderboardController;
  let mockUseCase: jest.Mocked<GetLeaderboardUseCase>;

  beforeEach(() => {
    mockUseCase = {
      execute: jest.fn(),
    } as any;
    controller = new LeaderboardController(mockUseCase);
  });

  it('should call execute with correct params', async () => {
    mockUseCase.execute.mockResolvedValue({} as any);

    await controller.getLeaderboard('user-id', { page: 2, limit: 10 });

    expect(mockUseCase.execute).toHaveBeenCalledWith({
      userId: 'user-id',
      page: 2,
      limit: 10,
    });
  });
});
