import { jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard.js';
import { type IUserRepository } from '../../modules/auth/domain/user.repository.js';
import { User } from '../../modules/auth/domain/user.entity.js';
import { Email } from '../../modules/auth/domain/value-objects/email.vo.js';
import { Password } from '../../modules/auth/domain/value-objects/password.vo.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let userRepository: jest.Mocked<IUserRepository>;
  let context: ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;

    userRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    guard = new RolesGuard(reflector, userRepository);
  });

  const createMockContext = (userPayload: any): ExecutionContext => {
    const getRequest = jest.fn().mockReturnValue({ user: userPayload });
    const switchToHttp = jest.fn().mockReturnValue({ getRequest });
    return {
      switchToHttp,
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  it('should allow access if no user payload exists in the request', async () => {
    context = createMockContext(null);
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access if user is not found in repository', async () => {
    context = createMockContext({ sub: 'user-1' });
    userRepository.findById.mockResolvedValueOnce(null as any);

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should throw ForbiddenException if user is banned', async () => {
    context = createMockContext({ sub: 'user-1' });
    const bannedUser = new User({
      id: 'user-1',
      email: new Email('banned@example.com'),
      password: Password.fromHash('hash'),
      displayName: 'Banned User',
      elo: 1000,
      isEmailVerified: true,
      role: 'USER',
      bannedUntil: new Date(Date.now() + 100000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    userRepository.findById.mockResolvedValueOnce(bannedUser);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should allow access if no roles are required', async () => {
    context = createMockContext({ sub: 'user-1' });
    const activeUser = new User({
      id: 'user-1',
      email: new Email('user@example.com'),
      password: Password.fromHash('hash'),
      displayName: 'Active User',
      elo: 1000,
      isEmailVerified: true,
      role: 'USER',
      bannedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    userRepository.findById.mockResolvedValueOnce(activeUser);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(undefined);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow access if user has the required role', async () => {
    context = createMockContext({ sub: 'admin-1' });
    const adminUser = new User({
      id: 'admin-1',
      email: new Email('admin@example.com'),
      password: Password.fromHash('hash'),
      displayName: 'Admin User',
      elo: 1000,
      isEmailVerified: true,
      role: 'ADMIN',
      bannedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    userRepository.findById.mockResolvedValueOnce(adminUser);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(['ADMIN']);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access if user does not have the required role', async () => {
    context = createMockContext({ sub: 'user-1' });
    const regularUser = new User({
      id: 'user-1',
      email: new Email('user@example.com'),
      password: Password.fromHash('hash'),
      displayName: 'Regular User',
      elo: 1000,
      isEmailVerified: true,
      role: 'USER',
      bannedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    userRepository.findById.mockResolvedValueOnce(regularUser);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(['ADMIN']);

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });
});
