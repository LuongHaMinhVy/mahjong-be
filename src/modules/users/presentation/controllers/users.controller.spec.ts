import { jest } from '@jest/globals';
import { UsersController } from './users.controller.js';
import { type GetUserProfileUseCase } from '../../application/use-cases/get-user-profile.use-case.js';
import { type UpdateUserProfileUseCase } from '../../application/use-cases/update-user-profile.use-case.js';
import { type GetMatchHistoryUseCase } from '../../application/use-cases/get-match-history.use-case.js';
import { ApiResponseDto } from '../../../../shared/dto/api-response.dto.js';

describe('UsersController', () => {
  let controller: UsersController;
  let mockGetProfile: jest.Mocked<GetUserProfileUseCase>;
  let mockUpdateProfile: jest.Mocked<UpdateUserProfileUseCase>;
  let mockGetHistory: jest.Mocked<GetMatchHistoryUseCase>;

  beforeEach(() => {
    mockGetProfile = {
      execute: jest.fn(),
    } as any;

    mockUpdateProfile = {
      execute: jest.fn(),
    } as any;

    mockGetHistory = {
      execute: jest.fn(),
    } as any;

    controller = new UsersController(
      mockGetProfile,
      mockUpdateProfile,
      mockGetHistory,
    );
  });

  describe('getProfile', () => {
    it('should return API response with user profile', async () => {
      const mockProfile = {
        id: 'user-123',
        email: 'test@email.com',
        displayName: 'Test User',
        avatar: 'avatar.png',
        elo: 1000,
        createdAt: new Date(),
        stats: {
          totalGames: 5,
          wins: 2,
          winRate: 0.4,
          currentElo: 1000,
        },
      };

      mockGetProfile.execute.mockResolvedValue(mockProfile);

      const result = await controller.getProfile('user-123');

      expect(mockGetProfile.execute).toHaveBeenCalledWith('user-123');
      expect(result).toBeInstanceOf(ApiResponseDto);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
    });
  });

  describe('updateProfile', () => {
    it('should call update use case and return API response', async () => {
      const mockUpdated = {
        id: 'user-123',
        email: 'test@email.com',
        displayName: 'New Name',
        avatar: 'new.png',
        elo: 1000,
        updatedAt: new Date(),
      };

      mockUpdateProfile.execute.mockResolvedValue(mockUpdated);

      const result = await controller.updateProfile('user-123', {
        displayName: 'New Name',
        avatar: 'new.png',
      });

      expect(mockUpdateProfile.execute).toHaveBeenCalledWith({
        userId: 'user-123',
        displayName: 'New Name',
        avatar: 'new.png',
      });
      expect(result).toBeInstanceOf(ApiResponseDto);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdated);
    });
  });

  describe('getMatchHistory', () => {
    it('should call get history use case and return API response', async () => {
      mockGetHistory.execute.mockResolvedValue([]);

      const result = await controller.getMatchHistory('user-123', {
        limit: 10,
        offset: 0,
      });

      expect(mockGetHistory.execute).toHaveBeenCalledWith('user-123', {
        limit: 10,
        offset: 0,
      });
      expect(result).toBeInstanceOf(ApiResponseDto);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });
});
