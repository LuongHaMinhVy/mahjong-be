import { jest } from '@jest/globals';
import { UpdateUserProfileUseCase } from './update-user-profile.use-case.js';
import { IUserRepository } from '../../../auth/domain/user.repository.js';
import { User } from '../../../auth/domain/user.entity.js';
import { Email } from '../../../auth/domain/value-objects/email.vo.js';
import { Password } from '../../../auth/domain/value-objects/password.vo.js';

describe('UpdateUserProfileUseCase', () => {
  let useCase: UpdateUserProfileUseCase;
  let mockUserRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      save: jest.fn(),
      findByEmail: jest.fn(),
    } as any;

    useCase = new UpdateUserProfileUseCase(mockUserRepo);
  });

  it('should throw if user does not exist', async () => {
    mockUserRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ userId: 'invalid', displayName: 'New Name' })
    ).rejects.toThrow('User not found');
  });

  it('should update and save user details', async () => {
    const user = new User({
      id: 'user-123',
      email: new Email('test@email.com'),
      password: Password.create('Password123!'),
      displayName: 'Old Name',
      avatar: 'old.png',
      elo: 1000,
    });

    mockUserRepo.findById.mockResolvedValue(user);
    mockUserRepo.save.mockResolvedValue(user);

    const result = await useCase.execute({
      userId: 'user-123',
      displayName: 'New Name',
      avatar: 'new.png',
    });

    expect(result.displayName).toBe('New Name');
    expect(result.avatar).toBe('new.png');
    expect(mockUserRepo.save).toHaveBeenCalled();
  });
});
