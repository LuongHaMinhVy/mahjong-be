import { jest } from '@jest/globals';
import { AdminBanUserUseCase } from './admin-ban-user.use-case.js';
import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { User } from '../../../auth/domain/user.entity.js';
import { Email } from '../../../auth/domain/value-objects/email.vo.js';
import { Password } from '../../../auth/domain/value-objects/password.vo.js';
import { NotFoundException } from '../../../../shared/exceptions/domain.exception.js';

describe('AdminBanUserUseCase', () => {
  let useCase: AdminBanUserUseCase;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockUser: User;

  beforeEach(() => {
    mockUser = new User({
      id: 'user-1',
      email: new Email('test@example.com'),
      password: Password.fromHash('hash'),
      displayName: 'Test User',
      avatar: null,
      elo: 1000,
      isEmailVerified: true,
      role: 'USER',
      bannedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockUserRepo = {
      save: jest.fn().mockResolvedValue(mockUser),
      findById: jest.fn().mockResolvedValue(mockUser),
      findByEmail: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue({ users: [], total: 0 }),
    } as unknown as jest.Mocked<IUserRepository>;

    useCase = new AdminBanUserUseCase(mockUserRepo);
  });

  it('should ban a user for specified duration in minutes', async () => {
    await useCase.execute({ userId: 'user-1', durationMinutes: 60 });

    expect(mockUserRepo.findById).toHaveBeenCalledWith('user-1');
    expect(mockUser.isBanned()).toBe(true);
    expect(mockUser.bannedUntil).toBeInstanceOf(Date);
    expect(mockUserRepo.save).toHaveBeenCalledWith(mockUser);
  });

  it('should unban a user when durationMinutes is null', async () => {
    mockUser.ban(new Date(Date.now() + 60000));
    expect(mockUser.isBanned()).toBe(true);

    await useCase.execute({ userId: 'user-1', durationMinutes: null });

    expect(mockUser.isBanned()).toBe(false);
    expect(mockUser.bannedUntil).toBeNull();
    expect(mockUserRepo.save).toHaveBeenCalledWith(mockUser);
  });

  it('should throw NotFoundException if user is not found', async () => {
    mockUserRepo.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({ userId: 'invalid-id', durationMinutes: 60 }),
    ).rejects.toThrow(NotFoundException);
  });
});
