import { jest } from '@jest/globals';
import { JoinQueueUseCase } from './join-queue.use-case.js';
import { LeaveQueueUseCase } from './leave-queue.use-case.js';
import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';
import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { User } from '../../../auth/domain/user.entity.js';
import { Email } from '../../../auth/domain/value-objects/email.vo.js';
import { Password } from '../../../auth/domain/value-objects/password.vo.js';

describe('JoinQueueUseCase & LeaveQueueUseCase', () => {
  let joinUseCase: JoinQueueUseCase;
  let leaveUseCase: LeaveQueueUseCase;
  let mockMatchmakingRepo: jest.Mocked<IMatchmakingRepository>;
  let mockUserRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockMatchmakingRepo = {
      addToQueue: jest.fn(),
      removeFromQueue: jest.fn(),
    } as any;
    mockUserRepo = {
      findById: jest.fn(),
    } as any;
    joinUseCase = new JoinQueueUseCase(mockMatchmakingRepo, mockUserRepo);
    leaveUseCase = new LeaveQueueUseCase(mockMatchmakingRepo);
  });

  it('should add player to queue with current elo', async () => {
    const mockUser = new User({
      id: 'u1',
      email: new Email('t@t.com'),
      password: Password.create('Password123!'),
      displayName: 'P1',
      avatar: null,
      elo: 1250,
      isEmailVerified: true,
    });
    mockUserRepo.findById.mockResolvedValue(mockUser);

    await joinUseCase.execute({ userId: 'u1', ruleset: 'riichi' });

    expect(mockMatchmakingRepo.addToQueue).toHaveBeenCalledWith('riichi', 'u1', 1250, expect.any(Date));
  });

  it('should remove player from queue', async () => {
    await leaveUseCase.execute({ userId: 'u1', ruleset: 'riichi' });

    expect(mockMatchmakingRepo.removeFromQueue).toHaveBeenCalledWith('riichi', 'u1');
  });
});
