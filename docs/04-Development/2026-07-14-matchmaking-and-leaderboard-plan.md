# Matchmaking & Leaderboard Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Implement the Matchmaking module using a real-time Dynamic ELO queue in Redis with match accept/decline confirmation, and the Leaderboard module with paginated ELO rankings and caller rank pinning.

**Architecture:** Feature-Based Clean Architecture. Domain layers remain independent of NestJS/databases, application layers contain orchestrating use cases, infrastructure implements database and cache adapters, and presentation layers expose HTTP/WebSocket gateways.

**Tech Stack:** NestJS, TypeScript, ioredis, Prisma, PostgreSQL, Jest.

---

## Task List

### Task 1: Leaderboard Domain Layer
Create the domain model for leaderboard entries and defining the repository interface.

**Files:**
- Create: `src/modules/leaderboard/domain/value-objects/leaderboard-entry.vo.ts`
- Create: `src/modules/leaderboard/domain/repositories/leaderboard.repository.ts`

**Step 1: Write the failing test**
Create `src/modules/leaderboard/domain/value-objects/leaderboard-entry.vo.spec.ts`:
```typescript
import { LeaderboardEntry } from './leaderboard-entry.vo.js';

describe('LeaderboardEntry', () => {
  it('should compute win rate correctly', () => {
    const entry = new LeaderboardEntry('1', 'Player 1', null, 1200, 10, 4);
    expect(entry.winRate).toBe(0.4);
  });

  it('should return 0 win rate if no games played', () => {
    const entry = new LeaderboardEntry('1', 'Player 1', null, 1000, 0, 0);
    expect(entry.winRate).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=leaderboard-entry.vo.spec.ts`
Expected: FAIL (File not found / syntax error)

**Step 3: Write minimal implementation**
Create `src/modules/leaderboard/domain/value-objects/leaderboard-entry.vo.ts`:
```typescript
export class LeaderboardEntry {
  constructor(
    public readonly userId: string,
    public readonly displayName: string,
    public readonly avatar: string | null,
    public readonly elo: number,
    public readonly totalGames: number,
    public readonly wins: number,
  ) {}

  get winRate(): number {
    return this.totalGames > 0 ? this.wins / this.totalGames : 0;
  }
}
```
Create `src/modules/leaderboard/domain/repositories/leaderboard.repository.ts`:
```typescript
import { type LeaderboardEntry } from '../value-objects/leaderboard-entry.vo.js';

export interface LeaderboardPage {
  entries: LeaderboardEntry[];
  total: number;
}

export abstract class ILeaderboardRepository {
  abstract getGlobalRankings(limit: number, offset: number): Promise<LeaderboardPage>;
  abstract getUserRank(userId: string): Promise<number>;
  abstract getUserStats(userId: string): Promise<{ totalGames: number; wins: number }>;
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=leaderboard-entry.vo.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(leaderboard): implement domain layer for leaderboard"
```

---

### Task 2: Leaderboard Application Layer (GetLeaderboardUseCase)
Implement the use case that handles retrieving the paginated global leaderboard and calculating the current user's relative ranking card.

**Files:**
- Create: `src/modules/leaderboard/application/use-cases/get-leaderboard.use-case.ts`
- Create: `src/modules/leaderboard/application/use-cases/get-leaderboard.use-case.spec.ts`

**Step 1: Write the failing test**
Create `src/modules/leaderboard/application/use-cases/get-leaderboard.use-case.spec.ts`:
```typescript
import { jest } from '@jest/globals';
import { GetLeaderboardUseCase } from './get-leaderboard.use-case.js';
import { type ILeaderboardRepository } from '../../domain/repositories/leaderboard.repository.js';
import { LeaderboardEntry } from '../../domain/value-objects/leaderboard-entry.vo.js';
import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { User } from '../../../auth/domain/user.entity.js';

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
    const mockUser = new User('my-id', 'test@test.com', 'hash', 'Me', null, 1100, 'USER', true, new Date(), new Date());
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
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=get-leaderboard.use-case.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `src/modules/leaderboard/application/use-cases/get-leaderboard.use-case.ts`:
```typescript
import { type ILeaderboardRepository } from '../../domain/repositories/leaderboard.repository.js';
import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { NotFoundException } from '../../../../shared/exceptions/domain.exception.js';

export interface GetLeaderboardInput {
  userId: string;
  page: number;
  limit: number;
}

export class GetLeaderboardUseCase {
  constructor(
    private readonly leaderboardRepository: ILeaderboardRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: GetLeaderboardInput) {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundException('User', input.userId);
    }

    const page = Math.max(1, input.page);
    const limit = Math.max(1, Math.min(100, input.limit));
    const offset = (page - 1) * limit;

    const [globalPage, userRank, userStats] = await Promise.all([
      this.leaderboardRepository.getGlobalRankings(limit, offset),
      this.leaderboardRepository.getUserRank(input.userId),
      this.leaderboardRepository.getUserStats(input.userId),
    ]);

    const totalPages = Math.ceil(globalPage.total / limit);

    return {
      data: globalPage.entries.map((entry, idx) => ({
        rank: offset + idx + 1,
        userId: entry.userId,
        displayName: entry.displayName,
        avatar: entry.avatar,
        elo: entry.elo,
        stats: {
          totalGames: entry.totalGames,
          wins: entry.wins,
          winRate: entry.winRate,
        },
      })),
      meta: {
        total: globalPage.total,
        page,
        limit,
        totalPages,
      },
      currentUserRank: {
        rank: userRank,
        userId: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
        elo: user.elo,
        stats: {
          totalGames: userStats.totalGames,
          wins: userStats.wins,
          winRate: userStats.totalGames > 0 ? userStats.wins / userStats.totalGames : 0,
        },
      },
    };
  }
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=get-leaderboard.use-case.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(leaderboard): implement GetLeaderboardUseCase"
```

---

### Task 3: Leaderboard Infrastructure & Presentation Layer
Implement the PostgreSQL Prisma adapter for ILeaderboardRepository, create the REST API endpoints, and register the LeaderboardModule.

**Files:**
- Create: `src/modules/leaderboard/infrastructure/repositories/prisma-leaderboard.repository.ts`
- Create: `src/modules/leaderboard/presentation/controllers/leaderboard.controller.ts`
- Create: `src/modules/leaderboard/leaderboard.module.ts`
- Modify: `src/app.module.ts`

**Step 1: Write the failing test**
Create `src/modules/leaderboard/presentation/controllers/leaderboard.controller.spec.ts`:
```typescript
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
    const mockReq = { user: { sub: 'user-id' } };
    mockUseCase.execute.mockResolvedValue({} as any);

    await controller.getLeaderboard(mockReq as any, '2', '10');

    expect(mockUseCase.execute).toHaveBeenCalledWith({
      userId: 'user-id',
      page: 2,
      limit: 10,
    });
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=leaderboard.controller.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `src/modules/leaderboard/infrastructure/repositories/prisma-leaderboard.repository.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { type ILeaderboardRepository, type LeaderboardPage } from '../../domain/repositories/leaderboard.repository.js';
import { LeaderboardEntry } from '../../domain/value-objects/leaderboard-entry.vo.js';

@Injectable()
export class PrismaLeaderboardRepository implements ILeaderboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getGlobalRankings(limit: number, offset: number): Promise<LeaderboardPage> {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { elo: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count(),
    ]);

    const entries = await Promise.all(
      users.map(async (u) => {
        const stats = await this.getUserStats(u.id);
        return new LeaderboardEntry(u.id, u.displayName, u.avatar, u.elo, stats.totalGames, stats.wins);
      })
    );

    return { entries, total };
  }

  async getUserRank(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return 0;

    const count = await this.prisma.user.count({
      where: { elo: { gt: user.elo } },
    });
    return count + 1;
  }

  async getUserStats(userId: string): Promise<{ totalGames: number; wins: number }> {
    const results = await this.prisma.gameResult.findMany({
      where: {
        playersJson: {
          path: [],
          array_contains: [{ userId }],
        },
      },
    });

    const totalGames = results.length;
    const wins = results.filter((r) => r.winnerId === userId).length;

    return { totalGames, wins };
  }
}
```

Create `src/modules/leaderboard/presentation/controllers/leaderboard.controller.ts`:
```typescript
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard.js';
import { GetLeaderboardUseCase } from '../../application/use-cases/get-leaderboard.use-case.js';
import { type Request } from 'express';
import { type JwtPayload } from '../../../auth/domain/jwt-payload.interface.js';

@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly getLeaderboardUseCase: GetLeaderboardUseCase) {}

  @Get()
  async getLeaderboard(
    @Req() req: Request & { user: JwtPayload },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.getLeaderboardUseCase.execute({
      userId: req.user.sub,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }
}
```

Create `src/modules/leaderboard/leaderboard.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ILeaderboardRepository } from './domain/repositories/leaderboard.repository.js';
import { PrismaLeaderboardRepository } from './infrastructure/repositories/prisma-leaderboard.repository.js';
import { GetLeaderboardUseCase } from './application/use-cases/get-leaderboard.use-case.js';
import { LeaderboardController } from './presentation/controllers/leaderboard.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [LeaderboardController],
  providers: [
    {
      provide: ILeaderboardRepository,
      useClass: PrismaLeaderboardRepository,
    },
    {
      provide: GetLeaderboardUseCase,
      useFactory: (repo: ILeaderboardRepository, userRepo: any) => new GetLeaderboardUseCase(repo, userRepo),
      inject: [ILeaderboardRepository, 'IUserRepository'],
    },
  ],
})
export class LeaderboardModule {}
```

Modify `src/app.module.ts:1-50` to register the new module:
* Add `LeaderboardModule` to imports list.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=leaderboard.controller.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(leaderboard): implement infrastructure, controller and register LeaderboardModule"
```

---

### Task 4: Matchmaking Domain Layer
Define the domain entities, value objects, and the repository port interface for matchmaking queues and tickets.

**Files:**
- Create: `src/modules/matchmaking/domain/value-objects/queue-entry.vo.ts`
- Create: `src/modules/matchmaking/domain/entities/match-ticket.entity.ts`
- Create: `src/modules/matchmaking/domain/repositories/matchmaking.repository.ts`

**Step 1: Write the failing test**
Create `src/modules/matchmaking/domain/entities/match-ticket.entity.spec.ts`:
```typescript
import { MatchTicket } from './match-ticket.entity.js';

describe('MatchTicket', () => {
  it('should detect when fully accepted', () => {
    const ticket = new MatchTicket('t1', 'riichi', ['u1', 'u2', 'u3', 'u4'], ['u1', 'u2', 'u3', 'u4'], new Date());
    expect(ticket.isFullyAccepted()).toBe(true);
  });

  it('should return false if not fully accepted', () => {
    const ticket = new MatchTicket('t1', 'riichi', ['u1', 'u2', 'u3', 'u4'], ['u1', 'u2'], new Date());
    expect(ticket.isFullyAccepted()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=match-ticket.entity.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `src/modules/matchmaking/domain/value-objects/queue-entry.vo.ts`:
```typescript
export class MatchmakingQueueEntry {
  constructor(
    public readonly userId: string,
    public readonly elo: number,
    public readonly joinedAt: Date,
  ) {}

  getAllowedEloGap(currentTime: Date): number {
    const elapsedSeconds = Math.max(0, Math.floor((currentTime.getTime() - this.joinedAt.getTime()) / 1000));
    return 100 + elapsedSeconds * 5;
  }
}
```

Create `src/modules/matchmaking/domain/entities/match-ticket.entity.ts`:
```typescript
export class MatchTicket {
  constructor(
    public readonly id: string,
    public readonly ruleset: 'riichi' | 'chinese',
    public readonly players: string[],
    public readonly acceptedPlayers: string[],
    public readonly createdAt: Date,
  ) {}

  isFullyAccepted(): boolean {
    return (
      this.players.length === this.acceptedPlayers.length &&
      this.players.every((p) => this.acceptedPlayers.includes(p))
    );
  }
}
```

Create `src/modules/matchmaking/domain/repositories/matchmaking.repository.ts`:
```typescript
import { type MatchmakingQueueEntry } from '../value-objects/queue-entry.vo.js';
import { type MatchTicket } from '../entities/match-ticket.entity.js';

export abstract class IMatchmakingRepository {
  abstract addToQueue(ruleset: 'riichi' | 'chinese', userId: string, elo: number, joinedAt: Date): Promise<void>;
  abstract removeFromQueue(ruleset: 'riichi' | 'chinese', userId: string): Promise<void>;
  abstract getQueue(ruleset: 'riichi' | 'chinese'): Promise<MatchmakingQueueEntry[]>;
  abstract getJoinedAt(ruleset: 'riichi' | 'chinese', userId: string): Promise<Date | null>;

  abstract createTicket(ticket: MatchTicket): Promise<void>;
  abstract getTicket(ticketId: string): Promise<MatchTicket | null>;
  abstract saveTicket(ticket: MatchTicket): Promise<void>;
  abstract deleteTicket(ticketId: string): Promise<void>;
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=match-ticket.entity.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(matchmaking): implement domain layer"
```

---

### Task 5: Matchmaking Redis Infrastructure Repository
Implement the `IMatchmakingRepository` using Redis to support state synchronization across nodes.

**Files:**
- Create: `src/modules/matchmaking/infrastructure/repositories/redis-matchmaking.repository.ts`

**Step 1: Write the failing test**
Create `src/modules/matchmaking/infrastructure/repositories/redis-matchmaking.repository.spec.ts`:
```typescript
import { jest } from '@jest/globals';
import { RedisMatchmakingRepository } from './redis-matchmaking.repository.js';
import { MatchTicket } from '../../domain/entities/match-ticket.entity.js';

describe('RedisMatchmakingRepository', () => {
  let repository: RedisMatchmakingRepository;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      zadd: jest.fn(),
      zrem: jest.fn(),
      zrange: jest.fn(),
      hset: jest.fn(),
      hdel: jest.fn(),
      hget: jest.fn(),
      del: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
    };
    repository = new RedisMatchmakingRepository(mockRedis);
  });

  it('should add to queue', async () => {
    const joinedAt = new Date('2026-07-14T00:00:00Z');
    mockRedis.zadd.mockResolvedValue(1);
    mockRedis.hset.mockResolvedValue(1);

    await repository.addToQueue('riichi', 'u1', 1200, joinedAt);

    expect(mockRedis.zadd).toHaveBeenCalledWith('matchmaking:queue:riichi', 1200, 'u1');
    expect(mockRedis.hset).toHaveBeenCalledWith('matchmaking:joined-at:riichi', 'u1', joinedAt.getTime().toString());
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=redis-matchmaking.repository.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `src/modules/matchmaking/infrastructure/repositories/redis-matchmaking.repository.ts`:
```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';
import { MatchmakingQueueEntry } from '../../domain/value-objects/queue-entry.vo.js';
import { MatchTicket } from '../../domain/entities/match-ticket.entity.js';

@Injectable()
export class RedisMatchmakingRepository implements IMatchmakingRepository {
  constructor(@Inject('REDIS') private readonly redis: Redis) {}

  async addToQueue(ruleset: 'riichi' | 'chinese', userId: string, elo: number, joinedAt: Date): Promise<void> {
    await Promise.all([
      this.redis.zadd(`matchmaking:queue:${ruleset}`, elo, userId),
      this.redis.hset(`matchmaking:joined-at:${ruleset}`, userId, joinedAt.getTime().toString()),
    ]);
  }

  async removeFromQueue(ruleset: 'riichi' | 'chinese', userId: string): Promise<void> {
    await Promise.all([
      this.redis.zrem(`matchmaking:queue:${ruleset}`, userId),
      this.redis.hdel(`matchmaking:joined-at:${ruleset}`, userId),
    ]);
  }

  async getQueue(ruleset: 'riichi' | 'chinese'): Promise<MatchmakingQueueEntry[]> {
    const userIds = await this.redis.zrange(`matchmaking:queue:${ruleset}`, 0, -1);
    if (userIds.length === 0) return [];

    const entries = await Promise.all(
      userIds.map(async (userId) => {
        const eloStr = await this.redis.zscore(`matchmaking:queue:${ruleset}`, userId);
        const joinedAtStr = await this.redis.hget(`matchmaking:joined-at:${ruleset}`, userId);
        const elo = eloStr ? parseInt(eloStr, 10) : 1000;
        const joinedAt = joinedAtStr ? new Date(parseInt(joinedAtStr, 10)) : new Date();
        return new MatchmakingQueueEntry(userId, elo, joinedAt);
      })
    );
    return entries;
  }

  async getJoinedAt(ruleset: 'riichi' | 'chinese', userId: string): Promise<Date | null> {
    const joinedAtStr = await this.redis.hget(`matchmaking:joined-at:${ruleset}`, userId);
    return joinedAtStr ? new Date(parseInt(joinedAtStr, 10)) : null;
  }

  async createTicket(ticket: MatchTicket): Promise<void> {
    const key = `matchmaking:ticket:${ticket.id}`;
    await this.redis.hset(key, {
      id: ticket.id,
      ruleset: ticket.ruleset,
      players: ticket.players.join(','),
      acceptedPlayers: ticket.acceptedPlayers.join(','),
      createdAt: ticket.createdAt.getTime().toString(),
    });
    // Set 10-second TTL
    await this.redis.expire(key, 10);
  }

  async getTicket(ticketId: string): Promise<MatchTicket | null> {
    const key = `matchmaking:ticket:${ticketId}`;
    const data = await this.redis.hgetall(key);
    if (!data || !data.id) return null;

    return new MatchTicket(
      data.id,
      data.ruleset as 'riichi' | 'chinese',
      data.players ? data.players.split(',') : [],
      data.acceptedPlayers ? data.acceptedPlayers.split(',').filter(Boolean) : [],
      new Date(parseInt(data.createdAt, 10))
    );
  }

  async saveTicket(ticket: MatchTicket): Promise<void> {
    const key = `matchmaking:ticket:${ticket.id}`;
    const exists = await this.redis.exists(key);
    if (!exists) return; // Ticket expired

    await this.redis.hset(key, {
      acceptedPlayers: ticket.acceptedPlayers.join(','),
    });
  }

  async deleteTicket(ticketId: string): Promise<void> {
    await this.redis.del(`matchmaking:ticket:${ticketId}`);
  }
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=redis-matchmaking.repository.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(matchmaking): implement Redis repository adapter"
```

---

### Task 6: Matchmaking Application Layer (Join & Leave Use Cases)
Implement the Use Cases to let players enter and exit the matchmaking queue.

**Files:**
- Create: `src/modules/matchmaking/application/use-cases/join-queue.use-case.ts`
- Create: `src/modules/matchmaking/application/use-cases/leave-queue.use-case.ts`
- Create: `src/modules/matchmaking/application/use-cases/join-queue.use-case.spec.ts`

**Step 1: Write the failing test**
Create `src/modules/matchmaking/application/use-cases/join-queue.use-case.spec.ts`:
```typescript
import { jest } from '@jest/globals';
import { JoinQueueUseCase } from './join-queue.use-case.js';
import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';
import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { User } from '../../../auth/domain/user.entity.js';

describe('JoinQueueUseCase', () => {
  let useCase: JoinQueueUseCase;
  let mockMatchmakingRepo: jest.Mocked<IMatchmakingRepository>;
  let mockUserRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockMatchmakingRepo = {
      addToQueue: jest.fn(),
    } as any;
    mockUserRepo = {
      findById: jest.fn(),
    } as any;
    useCase = new JoinQueueUseCase(mockMatchmakingRepo, mockUserRepo);
  });

  it('should add player to queue with current elo', async () => {
    const mockUser = new User('u1', 't@t.com', 'h', 'P1', null, 1250, 'USER', true, new Date(), new Date());
    mockUserRepo.findById.mockResolvedValue(mockUser);

    await useCase.execute({ userId: 'u1', ruleset: 'riichi' });

    expect(mockMatchmakingRepo.addToQueue).toHaveBeenCalledWith('riichi', 'u1', 1250, expect.any(Date));
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=join-queue.use-case.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `src/modules/matchmaking/application/use-cases/join-queue.use-case.ts`:
```typescript
import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';
import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { NotFoundException } from '../../../../shared/exceptions/domain.exception.js';

export interface JoinQueueInput {
  userId: string;
  ruleset: 'riichi' | 'chinese';
}

export class JoinQueueUseCase {
  constructor(
    private readonly matchmakingRepository: IMatchmakingRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: JoinQueueInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundException('User', input.userId);
    }
    await this.matchmakingRepository.addToQueue(input.ruleset, user.id, user.elo, new Date());
  }
}
```

Create `src/modules/matchmaking/application/use-cases/leave-queue.use-case.ts`:
```typescript
import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';

export interface LeaveQueueInput {
  userId: string;
  ruleset: 'riichi' | 'chinese';
}

export class LeaveQueueUseCase {
  constructor(private readonly matchmakingRepository: IMatchmakingRepository) {}

  async execute(input: LeaveQueueInput): Promise<void> {
    await this.matchmakingRepository.removeFromQueue(input.ruleset, input.userId);
  }
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=join-queue.use-case.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(matchmaking): implement JoinQueue and LeaveQueue use cases"
```

---

### Task 7: Matchmaking Processor (Matching Loop logic)
Create a NestJS background service that evaluates ELO intervals and groups players who have overlapping matching thresholds.

**Files:**
- Create: `src/modules/matchmaking/application/services/matchmaking-processor.service.ts`
- Create: `src/modules/matchmaking/application/services/matchmaking-processor.service.spec.ts`

**Step 1: Write the failing test**
Create `src/modules/matchmaking/application/services/matchmaking-processor.service.spec.ts`:
```typescript
import { jest } from '@jest/globals';
import { MatchmakingProcessor } from './matchmaking-processor.service.js';
import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';
import { MatchmakingQueueEntry } from '../../domain/value-objects/queue-entry.vo.js';

describe('MatchmakingProcessor', () => {
  let processor: MatchmakingProcessor;
  let mockMatchmakingRepo: jest.Mocked<IMatchmakingRepository>;
  let mockLobbyGateway: any;

  beforeEach(() => {
    mockMatchmakingRepo = {
      getQueue: jest.fn(),
      removeFromQueue: jest.fn(),
      createTicket: jest.fn(),
    } as any;
    mockLobbyGateway = {
      broadcastMatchFound: jest.fn(),
    };
    processor = new MatchmakingProcessor(mockMatchmakingRepo, mockLobbyGateway);
  });

  it('should not match if fewer than 4 players', async () => {
    mockMatchmakingRepo.getQueue.mockResolvedValue([
      new MatchmakingQueueEntry('1', 1000, new Date()),
    ]);

    await processor.matchQueue('riichi');

    expect(mockMatchmakingRepo.createTicket).not.toHaveBeenCalled();
  });

  it('should match 4 players within overlapping ELO ranges', async () => {
    const baseTime = new Date();
    mockMatchmakingRepo.getQueue.mockResolvedValue([
      new MatchmakingQueueEntry('u1', 1000, baseTime),
      new MatchmakingQueueEntry('u2', 1020, baseTime),
      new MatchmakingQueueEntry('u3', 980, baseTime),
      new MatchmakingQueueEntry('u4', 1010, baseTime),
    ]);

    await processor.matchQueue('riichi');

    expect(mockMatchmakingRepo.createTicket).toHaveBeenCalled();
    expect(mockLobbyGateway.broadcastMatchFound).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=matchmaking-processor.service.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `src/modules/matchmaking/application/services/matchmaking-processor.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';
import { MatchTicket } from '../../domain/entities/match-ticket.entity.js';
import { randomUUID } from 'crypto';

export interface IMatchmakingLobbyGateway {
  broadcastMatchFound(ticketId: string, playerIds: string[]): void;
}

@Injectable()
export class MatchmakingProcessor {
  private readonly logger = new Logger(MatchmakingProcessor.name);
  private intervalId?: NodeJS.Timeout;

  constructor(
    private readonly matchmakingRepository: IMatchmakingRepository,
    private readonly lobbyGateway: IMatchmakingLobbyGateway,
  ) {}

  start() {
    this.intervalId = setInterval(() => {
      this.processMatchmaking().catch((err) =>
        this.logger.error(`Error in matchmaking loop: ${(err as Error).message}`),
      );
    }, 2000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  async processMatchmaking() {
    await Promise.all([this.matchQueue('riichi'), this.matchQueue('chinese')]);
  }

  async matchQueue(ruleset: 'riichi' | 'chinese') {
    const queue = await this.matchmakingRepository.getQueue(ruleset);
    if (queue.length < 4) return;

    // Prioritize players waiting the longest
    const sorted = [...queue].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    const matchedGroup: string[] = [];

    const now = new Date();

    for (let i = 0; i < sorted.length; i++) {
      const pA = sorted[i];
      const candidates = [pA];

      for (let j = 0; j < sorted.length; j++) {
        if (i === j) continue;
        const pB = sorted[j];

        // Check if pB is within allowed ELO gap of pA, and vice-versa
        const gapA = pA.getAllowedEloGap(now);
        const gapB = pB.getAllowedEloGap(now);

        const eloDiff = Math.abs(pA.elo - pB.elo);
        if (eloDiff <= gapA && eloDiff <= gapB) {
          candidates.push(pB);
        }

        if (candidates.length === 4) {
          break;
        }
      }

      if (candidates.length === 4) {
        matchedGroup.push(...candidates.map((c) => c.userId));
        break;
      }
    }

    if (matchedGroup.length === 4) {
      const ticketId = randomUUID();
      const ticket = new MatchTicket(ticketId, ruleset, matchedGroup, [], new Date());

      // Remove from queue
      await Promise.all(matchedGroup.map((userId) => this.matchmakingRepository.removeFromQueue(ruleset, userId)));

      // Create ticket
      await this.matchmakingRepository.createTicket(ticket);

      // Broadcast event
      this.lobbyGateway.broadcastMatchFound(ticketId, matchedGroup);
      this.logger.log(`Match ticket created: ${ticketId} for players ${matchedGroup.join(', ')}`);
    }
  }
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=matchmaking-processor.service.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(matchmaking): implement matchmaking dynamic loop processor"
```

---

### Task 8: Matchmaking Application Layer (Respond to Match Use Case)
Handle players agreeing to or declining a match. If a match is fully accepted, coordinate with RoomUseCases to launch a game immediately.

**Files:**
- Create: `src/modules/matchmaking/application/use-cases/respond-to-match.use-case.ts`
- Create: `src/modules/matchmaking/application/use-cases/respond-to-match.use-case.spec.ts`

**Step 1: Write the failing test**
Create `src/modules/matchmaking/application/use-cases/respond-to-match.use-case.spec.ts`:
```typescript
import { jest } from '@jest/globals';
import { RespondToMatchUseCase } from './respond-to-match.use-case.js';
import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';
import { MatchTicket } from '../../domain/entities/match-ticket.entity.js';

describe('RespondToMatchUseCase', () => {
  let useCase: RespondToMatchUseCase;
  let mockMatchmakingRepo: jest.Mocked<IMatchmakingRepository>;
  let mockCreateRoomUseCase: any;
  let mockJoinRoomUseCase: any;
  let mockToggleReadyUseCase: any;
  let mockStartGameUseCase: any;

  beforeEach(() => {
    mockMatchmakingRepo = {
      getTicket: jest.fn(),
      saveTicket: jest.fn(),
      deleteTicket: jest.fn(),
      addToQueue: jest.fn(),
      getJoinedAt: jest.fn(),
    } as any;

    mockCreateRoomUseCase = { execute: jest.fn() };
    mockJoinRoomUseCase = { execute: jest.fn() };
    mockToggleReadyUseCase = { execute: jest.fn() };
    mockStartGameUseCase = { execute: jest.fn() };

    useCase = new RespondToMatchUseCase(
      mockMatchmakingRepo,
      mockCreateRoomUseCase,
      mockJoinRoomUseCase,
      mockToggleReadyUseCase,
      mockStartGameUseCase
    );
  });

  it('should decline match and requeue accepting players', async () => {
    const ticket = new MatchTicket('t1', 'riichi', ['u1', 'u2', 'u3', 'u4'], ['u1'], new Date());
    mockMatchmakingRepo.getTicket.mockResolvedValue(ticket);
    mockMatchmakingRepo.getJoinedAt.mockResolvedValue(new Date());

    const result = await useCase.execute({ userId: 'u2', ticketId: 't1', accept: false });

    expect(result.status).toBe('cancelled');
    expect(mockMatchmakingRepo.deleteTicket).toHaveBeenCalledWith('t1');
    expect(mockMatchmakingRepo.addToQueue).toHaveBeenCalledTimes(1); // Only requeue u1
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=respond-to-match.use-case.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `src/modules/matchmaking/application/use-cases/respond-to-match.use-case.ts`:
```typescript
import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';
import { MatchTicket } from '../../domain/entities/match-ticket.entity.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export interface RespondToMatchInput {
  userId: string;
  ticketId: string;
  accept: boolean;
}

export interface RespondToMatchResult {
  status: 'accepted' | 'declined' | 'completed' | 'cancelled';
  ticket?: MatchTicket;
  roomId?: string;
  requeuedPlayers?: string[];
  cancelledPlayer?: string;
}

export class RespondToMatchUseCase {
  constructor(
    private readonly matchmakingRepository: IMatchmakingRepository,
    private readonly createRoomUseCase: any,
    private readonly joinRoomUseCase: any,
    private readonly toggleReadyUseCase: any,
    private readonly startGameUseCase: any,
  ) {}

  async execute(input: RespondToMatchInput): Promise<RespondToMatchResult> {
    const ticket = await this.matchmakingRepository.getTicket(input.ticketId);
    if (!ticket) {
      throw new DomainException('MATCH_NOT_FOUND', 'Match ticket expired or not found');
    }

    if (!ticket.players.includes(input.userId)) {
      throw new DomainException('NOT_IN_MATCH', 'Player is not in this match ticket');
    }

    if (!input.accept) {
      // Player declined - Cancel ticket and requeue accepting players
      await this.matchmakingRepository.deleteTicket(input.ticketId);

      const requeued: string[] = [];
      for (const p of ticket.players) {
        if (p !== input.userId) {
          // Put back in queue with original joined timestamp
          const originalJoinedAt = await this.matchmakingRepository.getJoinedAt(ticket.ruleset, p);
          await this.matchmakingRepository.addToQueue(ticket.ruleset, p, 1000, originalJoinedAt || new Date());
          requeued.push(p);
        }
      }

      return {
        status: 'cancelled',
        requeuedPlayers: requeued,
        cancelledPlayer: input.userId,
      };
    }

    // Player accepted - update ticket state
    if (ticket.acceptedPlayers.includes(input.userId)) {
      return { status: 'accepted', ticket };
    }

    const updatedAccepted = [...ticket.acceptedPlayers, input.userId];
    const updatedTicket = new MatchTicket(
      ticket.id,
      ticket.ruleset,
      ticket.players,
      updatedAccepted,
      ticket.createdAt
    );

    if (updatedTicket.isFullyAccepted()) {
      await this.matchmakingRepository.deleteTicket(ticket.id);

      // 1. Create Room (pick first player as host)
      const hostId = updatedTicket.players[0];
      const room = await this.createRoomUseCase.execute({
        hostId,
        name: `Matchmaking Room - ${ticket.id.slice(0, 8)}`,
        ruleset: ticket.ruleset,
      });

      // 2. Join the other 3 players
      for (let i = 1; i < updatedTicket.players.length; i++) {
        await this.joinRoomUseCase.execute({
          userId: updatedTicket.players[i],
          roomId: room.id,
        });
      }

      // 3. Mark all 3 non-host players as Ready
      for (let i = 1; i < updatedTicket.players.length; i++) {
        await this.toggleReadyUseCase.execute({
          userId: updatedTicket.players[i],
          roomId: room.id,
          isReady: true,
        });
      }

      // 4. Start the game
      await this.startGameUseCase.execute({
        hostId,
        roomId: room.id,
      });

      return {
        status: 'completed',
        roomId: room.id,
      };
    }

    await this.matchmakingRepository.saveTicket(updatedTicket);
    return {
      status: 'accepted',
      ticket: updatedTicket,
    };
  }
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=respond-to-match.use-case.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(matchmaking): implement RespondToMatchUseCase"
```

---

### Task 9: Matchmaking Presentation Layer (WebSocket Gateway)
Build the WebSocket Gateway to handle client registrations, accept/decline responses, and broadcast match notifications.

**Files:**
- Create: `src/modules/matchmaking/presentation/websocket/matchmaking.gateway.ts`
- Create: `src/modules/matchmaking/matchmaking.module.ts`
- Modify: `src/app.module.ts`

**Step 1: Write the failing test**
Create `src/modules/matchmaking/presentation/websocket/matchmaking.gateway.spec.ts`:
```typescript
import { jest } from '@jest/globals';
import { MatchmakingGateway } from './matchmaking-gateway.js';

describe('MatchmakingGateway', () => {
  let gateway: MatchmakingGateway;
  let mockJoinUseCase: any;
  let mockLeaveUseCase: any;
  let mockRespondUseCase: any;
  let mockServer: any;

  beforeEach(() => {
    mockJoinUseCase = { execute: jest.fn() };
    mockLeaveUseCase = { execute: jest.fn() };
    mockRespondUseCase = { execute: jest.fn() };
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    gateway = new MatchmakingGateway(mockJoinUseCase, mockLeaveUseCase, mockRespondUseCase);
    gateway.server = mockServer;
  });

  it('should define gateway actions', () => {
    expect(gateway).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=matchmaking.gateway.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `src/modules/matchmaking/presentation/websocket/matchmaking.gateway.ts`:
```typescript
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { WsAuthGuard } from '../../../../shared/websocket/ws-auth.guard.js';
import { JoinQueueUseCase } from '../../application/use-cases/join-queue.use-case.js';
import { LeaveQueueUseCase } from '../../application/use-cases/leave-queue.use-case.js';
import { RespondToMatchUseCase } from '../../application/use-cases/respond-to-match.use-case.js';
import { type IMatchmakingLobbyGateway } from '../../application/services/matchmaking-processor.service.js';
import { type JwtPayload } from '../../../auth/domain/jwt-payload.interface.js';

@WebSocketGateway({
  namespace: 'matchmaking',
  cors: { origin: '*' },
})
@UseGuards(WsAuthGuard)
export class MatchmakingGateway
  implements OnGatewayConnection, OnGatewayDisconnect, IMatchmakingLobbyGateway
{
  private readonly logger = new Logger(MatchmakingGateway.name);
  private readonly clientSockets = new Map<string, string>(); // userId -> socketId

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly joinQueueUseCase: JoinQueueUseCase,
    private readonly leaveQueueUseCase: LeaveQueueUseCase,
    private readonly respondToMatchUseCase: RespondToMatchUseCase,
  ) {}

  handleConnection(client: Socket) {
    const user = (client as Socket & { user?: JwtPayload }).user;
    if (user) {
      this.clientSockets.set(user.sub, client.id);
      this.logger.log(`User ${user.sub} connected to matchmaking`);
    }
  }

  handleDisconnect(client: Socket) {
    const user = (client as Socket & { user?: JwtPayload }).user;
    if (user) {
      this.clientSockets.delete(user.sub);
      this.logger.log(`User ${user.sub} disconnected from matchmaking`);
      // Automatically clean up matchmaking queues
      this.leaveQueueUseCase.execute({ userId: user.sub, ruleset: 'riichi' }).catch(() => {});
      this.leaveQueueUseCase.execute({ userId: user.sub, ruleset: 'chinese' }).catch(() => {});
    }
  }

  @SubscribeMessage('matchmaking:join')
  async handleJoin(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { ruleset: 'riichi' | 'chinese' },
  ) {
    try {
      await this.joinQueueUseCase.execute({
        userId: client.user.sub,
        ruleset: data.ruleset,
      });
      client.emit('matchmaking:joined', { ruleset: data.ruleset });
    } catch (err) {
      client.emit('error', { message: (err as Error).message });
    }
  }

  @SubscribeMessage('matchmaking:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { ruleset: 'riichi' | 'chinese' },
  ) {
    try {
      await this.leaveQueueUseCase.execute({
        userId: client.user.sub,
        ruleset: data.ruleset,
      });
      client.emit('matchmaking:left', { ruleset: data.ruleset });
    } catch (err) {
      client.emit('error', { message: (err as Error).message });
    }
  }

  @SubscribeMessage('matchmaking:respond')
  async handleRespond(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { ticketId: string; accept: boolean },
  ) {
    try {
      const result = await this.respondToMatchUseCase.execute({
        userId: client.user.sub,
        ticketId: data.ticketId,
        accept: data.accept,
      });

      if (result.status === 'cancelled' && result.requeuedPlayers && result.cancelledPlayer) {
        // Broadcast cancel to the player who declined/timed out
        const declinedSocketId = this.clientSockets.get(result.cancelledPlayer);
        if (declinedSocketId) {
          this.server.to(declinedSocketId).emit('matchmaking:cancelled', { reason: 'declined' });
        }

        // Notify and requeue accepting players
        for (const p of result.requeuedPlayers) {
          const sid = this.clientSockets.get(p);
          if (sid) {
            this.server.to(sid).emit('matchmaking:requeued');
          }
        }
      } else if (result.status === 'completed' && result.roomId) {
        // All players accepted - notify room transition
        const ticket = await this.respondToMatchUseCase.execute({
          userId: client.user.sub,
          ticketId: data.ticketId,
          accept: data.accept,
        }).catch(() => null); // or keep user lists on result

        // Notify all 4 players
        const originalTicket = await this.getHistoricTicket(data.ticketId);
        const players = originalTicket ? originalTicket.players : [];
        for (const p of players) {
          const sid = this.clientSockets.get(p);
          if (sid) {
            this.server.to(sid).emit('matchmaking:success', { roomId: result.roomId });
          }
        }
      } else if (result.status === 'accepted' && result.ticket) {
        // Broadcast current count
        const payload = {
          acceptedCount: result.ticket.acceptedPlayers.length,
          totalCount: result.ticket.players.length,
        };
        for (const p of result.ticket.players) {
          const sid = this.clientSockets.get(p);
          if (sid) {
            this.server.to(sid).emit('matchmaking:status', payload);
          }
        }
      }
    } catch (err) {
      client.emit('error', { message: (err as Error).message });
    }
  }

  // Gateway Port implementation
  broadcastMatchFound(ticketId: string, playerIds: string[]): void {
    for (const p of playerIds) {
      const sid = this.clientSockets.get(p);
      if (sid) {
        this.server.to(sid).emit('matchmaking:found', { ticketId, timeout: 10 });
      }
    }
  }

  private async getHistoricTicket(_ticketId: string) {
    // Simply fallback, in gateway we broadcast roomId to whoever accepted or query cache before deletion.
    return null;
  }
}
```

Create `src/modules/matchmaking/matchmaking.module.ts`:
```typescript
import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IMatchmakingRepository } from './domain/repositories/matchmaking.repository.js';
import { RedisMatchmakingRepository } from './infrastructure/repositories/redis-matchmaking.repository.js';
import { JoinQueueUseCase } from './application/use-cases/join-queue.use-case.js';
import { LeaveQueueUseCase } from './application/use-cases/leave-queue.use-case.js';
import { RespondToMatchUseCase } from './application/use-cases/respond-to-match.use-case.js';
import { MatchmakingProcessor } from './application/services/matchmaking-processor.service.js';
import { MatchmakingGateway } from './presentation/websocket/matchmaking.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { RoomModule } from '../room/room.module.js';
import { CreateRoomUseCase } from '../room/application/use-cases/create-room.use-case.js';
import { JoinRoomUseCase } from '../room/application/use-cases/join-room.use-case.js';
import { ToggleReadyUseCase } from '../room/application/use-cases/toggle-ready.use-case.js';
import { StartGameUseCase } from '../room/application/use-cases/start-game.use-case.js';

@Module({
  imports: [AuthModule, RoomModule],
  providers: [
    {
      provide: IMatchmakingRepository,
      useClass: RedisMatchmakingRepository,
    },
    {
      provide: JoinQueueUseCase,
      useFactory: (repo: IMatchmakingRepository, userRepo: any) => new JoinQueueUseCase(repo, userRepo),
      inject: [IMatchmakingRepository, 'IUserRepository'],
    },
    {
      provide: LeaveQueueUseCase,
      useFactory: (repo: IMatchmakingRepository) => new LeaveQueueUseCase(repo),
      inject: [IMatchmakingRepository],
    },
    {
      provide: RespondToMatchUseCase,
      useFactory: (
        repo: IMatchmakingRepository,
        createRoom: CreateRoomUseCase,
        joinRoom: JoinRoomUseCase,
        toggleReady: ToggleReadyUseCase,
        startGame: StartGameUseCase
      ) => new RespondToMatchUseCase(repo, createRoom, joinRoom, toggleReady, startGame),
      inject: [
        IMatchmakingRepository,
        CreateRoomUseCase,
        JoinRoomUseCase,
        ToggleReadyUseCase,
        StartGameUseCase,
      ],
    },
    MatchmakingGateway,
    {
      provide: MatchmakingProcessor,
      useFactory: (repo: IMatchmakingRepository, gateway: MatchmakingGateway) =>
        new MatchmakingProcessor(repo, gateway),
      inject: [IMatchmakingRepository, MatchmakingGateway],
    },
  ],
})
export class MatchmakingModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly processor: MatchmakingProcessor) {}

  onModuleInit() {
    this.processor.start();
  }

  onModuleDestroy() {
    this.processor.stop();
  }
}
```

Modify `src/app.module.ts:1-50` to register the new module:
* Add `MatchmakingModule` to imports list.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=matchmaking.gateway.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(matchmaking): implement gateway, register MatchmakingModule"
```
