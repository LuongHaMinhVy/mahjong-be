import { jest } from '@jest/globals';
import { GetUserProfileUseCase } from './get-user-profile.use-case.js';
import { type IUserStatsRepository } from '../../domain/repositories/user-stats.repository.js';
import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { User } from '../../../auth/domain/user.entity.js';
import { Email } from '../../../auth/domain/value-objects/email.vo.js';
import { Password } from '../../../auth/domain/value-objects/password.vo.js';

describe('GetUserProfileUseCase', () => {
  let useCase: GetUserProfileUseCase;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockUserStatsRepo: jest.Mocked<IUserStatsRepository>;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      save: jest.fn(),
      findByEmail: jest.fn(),
    } as any;

    mockUserStatsRepo = {
      getStats: jest.fn(),
      getMatchHistory: jest.fn(),
    } as any;

    useCase = new GetUserProfileUseCase(mockUserRepo, mockUserStatsRepo);
  });

  it('should throw an error if user is not found', async () => {
    mockUserRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('invalid-id')).rejects.toThrow(
      'User not found',
    );
  });

  it('should return user profile combined with statistics', async () => {
    const user = new User({
      id: 'user-123',
      email: new Email('test@email.com'),
      password: Password.create('Password123!'),
      displayName: 'Test User',
      avatar: 'avatar.png',
      elo: 1000,
    });

    const stats = {
      totalGames: 5,
      wins: 2,
      winRate: 0.4,
      currentElo: 1000,
    };

    mockUserRepo.findById.mockResolvedValue(user);
    mockUserStatsRepo.getStats.mockResolvedValue(stats);

    const result = await useCase.execute('user-123');

    expect(result).toEqual({
      id: 'user-123',
      email: 'test@email.com',
      displayName: 'Test User',
      avatar: 'avatar.png',
      elo: 1000,
      createdAt: user.createdAt,
      stats,
    });
  });
});
