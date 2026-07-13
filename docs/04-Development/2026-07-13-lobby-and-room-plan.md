# Lobby & Room Modules Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Implement real-time lobby room listings and game room coordination (create, join, leave, ready, start) powered by Redis state management and WebSockets.

**Architecture:** Following Clean Architecture. Transient states (online players and room states) are managed in Redis via a custom repository implementation, while PostgreSQL handles core user fields. The application layer handles business flows via use cases, triggered by WebSocket Gateways.

**Tech Stack:** NestJS, WebSockets (@nestjs/websockets), Redis, Prisma, Jest.

---

### Task 41: User Schema Update (Admin Role)

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Write the failing test**
*(No unit test needed for database schema change)*

**Step 2: Run test to verify it fails**
*(Skip)*

**Step 3: Write minimal implementation**
Modify `prisma/schema.prisma` to add `role String @default("USER")` to `User` model:
```prisma
model User {
  id              String         @id @default(uuid())
  email           String         @unique
  passwordHash    String         @map("password_hash")
  displayName     String         @map("display_name")
  avatar          String?
  elo             Int            @default(1000)
  role            String         @default("USER")
  isEmailVerified boolean        @default(false) @map("is_email_verified")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")
  refreshTokens   RefreshToken[]
  gameResults     GameResult[]   @relation("WinnerRelation")

  @@map("users")
}
```

Run migrations:
`pnpm prisma migrate dev --name add_user_role`

**Step 4: Run test to verify it passes**
Verify that the database migration executes successfully and `pnpm build` works.

**Step 5: Commit**
```bash
git add .
git commit -m "feat(db): add user role field and run migrations"
```

---

### Task 42: Room Player Value Object

**Files:**
- Create: `src/modules/room/domain/value-objects/room-player.vo.ts`
- Test: `src/modules/room/domain/value-objects/room-player.vo.spec.ts`

**Step 1: Write the failing test**
Create `src/modules/room/domain/value-objects/room-player.vo.spec.ts`:
```typescript
import { RoomPlayer } from './room-player.vo.js';

describe('RoomPlayer', () => {
  it('should create a room player correctly', () => {
    const player = new RoomPlayer('user-1', 'Vy', 'avatar.png', 1000, false);
    expect(player.userId).toBe('user-1');
    expect(player.displayName).toBe('Vy');
    expect(player.isReady).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- src/modules/room/domain/value-objects/room-player.vo.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `src/modules/room/domain/value-objects/room-player.vo.ts`:
```typescript
export class RoomPlayer {
  constructor(
    public readonly userId: string,
    public readonly displayName: string,
    public readonly avatar: string | null,
    public readonly elo: number,
    public isReady: boolean = false,
  ) {}
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- src/modules/room/domain/value-objects/room-player.vo.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(room): implement RoomPlayer value object"
```

---

### Task 43: Room Entity

**Files:**
- Create: `src/modules/room/domain/entities/room.entity.ts`
- Test: `src/modules/room/domain/entities/room.entity.spec.ts`

**Step 1: Write the failing test**
Create `src/modules/room/domain/entities/room.entity.spec.ts`:
```typescript
import { Room } from './room.entity.js';
import { RoomPlayer } from '../value-objects/room-player.vo.js';

describe('Room Entity', () => {
  it('should support adding and removing players', () => {
    const room = new Room('r-1', 'My Room', 'user-1', 'riichi', 'waiting', [
      new RoomPlayer('user-1', 'Vy', null, 1000, false)
    ]);

    const player2 = new RoomPlayer('user-2', 'Player 2', null, 1000, false);
    room.addPlayer(player2);
    expect(room.players.length).toBe(2);

    room.removePlayer('user-2');
    expect(room.players.length).toBe(1);
  });

  it('should assign a new host if host leaves', () => {
    const room = new Room('r-1', 'My Room', 'user-1', 'riichi', 'waiting', [
      new RoomPlayer('user-1', 'Vy', null, 1000, false),
      new RoomPlayer('user-2', 'Player 2', null, 1000, false)
    ]);

    room.removePlayer('user-1');
    expect(room.hostId).toBe('user-2');
  });

  it('should only start when all players except host are ready and there are 4 players', () => {
    const players = [
      new RoomPlayer('u1', 'P1', null, 1000, false),
      new RoomPlayer('u2', 'P2', null, 1000, true),
      new RoomPlayer('u3', 'P3', null, 1000, true),
      new RoomPlayer('u4', 'P4', null, 1000, true)
    ];
    const room = new Room('r-1', 'My Room', 'u1', 'riichi', 'waiting', players);
    expect(room.canStart()).toBe(true);

    room.toggleReady('u2', false);
    expect(room.canStart()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- src/modules/room/domain/entities/room.entity.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `src/modules/room/domain/entities/room.entity.ts`:
```typescript
import { RoomPlayer } from '../value-objects/room-player.vo.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export class Room {
  constructor(
    public readonly id: string,
    public name: string,
    public hostId: string,
    public readonly ruleset: 'riichi' | 'chinese',
    public status: 'waiting' | 'playing',
    public readonly players: RoomPlayer[],
  ) {}

  addPlayer(player: RoomPlayer): void {
    if (this.players.length >= 4) {
      throw new DomainException('ROOM_FULL', 'Room is full');
    }
    if (this.players.some((p) => p.userId === player.userId)) {
      throw new DomainException('ALREADY_IN_ROOM', 'Player already in room');
    }
    this.players.push(player);
  }

  removePlayer(userId: string): void {
    const index = this.players.findIndex((p) => p.userId === userId);
    if (index === -1) {
      throw new DomainException('PLAYER_NOT_IN_ROOM', 'Player not found in room');
    }
    this.players.splice(index, 1);

    if (this.hostId === userId && this.players.length > 0) {
      this.hostId = this.players[0].userId;
    }
  }

  toggleReady(userId: string, isReady: boolean): void {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) {
      throw new DomainException('PLAYER_NOT_IN_ROOM', 'Player not found in room');
    }
    player.isReady = isReady;
  }

  canStart(): boolean {
    if (this.players.length !== 4) return false;
    return this.players.every((p) => p.userId === this.hostId || p.isReady);
  }

  start(): void {
    if (!this.canStart()) {
      throw new DomainException('CANNOT_START', 'Cannot start room');
    }
    this.status = 'playing';
  }
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- src/modules/room/domain/entities/room.entity.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(room): implement Room domain entity and behaviors"
```

---

### Task 44: Room Repository Interface

**Files:**
- Create: `src/modules/room/domain/repositories/room.repository.ts`

**Step 1: Write the failing test**
*(No unit test needed for abstract repository interface)*

**Step 2: Run test to verify it fails**
*(Skip)*

**Step 3: Write minimal implementation**
Create `src/modules/room/domain/repositories/room.repository.ts`:
```typescript
import { Room } from '../entities/room.entity.js';

export abstract class IRoomRepository {
  abstract save(room: Room): Promise<void>;
  abstract findById(id: string): Promise<Room | null>;
  abstract delete(id: string): Promise<void>;
  abstract findAllWaiting(): Promise<Room[]>;
}
```

**Step 4: Run test to verify it passes**
Verify it builds cleanly.

**Step 5: Commit**
```bash
git add .
git commit -m "feat(room): define IRoomRepository port interface"
```

---

### Task 45: Room Use Cases

**Files:**
- Create: `src/modules/room/application/use-cases/create-room.use-case.ts`
- Create: `src/modules/room/application/use-cases/join-room.use-case.ts`
- Create: `src/modules/room/application/use-cases/leave-room.use-case.ts`
- Create: `src/modules/room/application/use-cases/toggle-ready.use-case.ts`
- Create: `src/modules/room/application/use-cases/start-game.use-case.ts`
- Test: `src/modules/room/application/use-cases/room-use-cases.spec.ts`

**Step 1: Write the failing test**
Create `src/modules/room/application/use-cases/room-use-cases.spec.ts` containing test suites for all 5 use cases.

**Step 2: Run test to verify it fails**
Run: `pnpm test -- src/modules/room/application/use-cases/room-use-cases.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Implement all 5 use case classes:
- Inject `IRoomRepository` and `IUserRepository` (to fetch player profile info when joining/creating rooms).
- `CreateRoomUseCase`: Creates a new Room entity with Host, saves it, and returns the room.
- `JoinRoomUseCase`: Fetches user ELO and displayName, creates a `RoomPlayer`, calls `room.addPlayer(player)`, saves the room.
- `LeaveRoomUseCase`: Calls `room.removePlayer(userId)`. If the room is empty, calls `repo.delete(roomId)`. Otherwise saves room.
- `ToggleReadyUseCase`: Calls `room.toggleReady(userId, isReady)` and saves room.
- `StartGameUseCase`: Verifies host status, calls `room.start()`, and saves room.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- src/modules/room/application/use-cases/room-use-cases.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(room): implement all room use cases and tests"
```

---

### Task 46: Infrastructure - Redis Room Repository

**Files:**
- Create: `src/modules/room/infrastructure/repositories/redis-room.repository.ts`
- Test: `src/modules/room/infrastructure/repositories/redis-room.repository.spec.ts`

**Step 1: Write the failing test**
Create `src/modules/room/infrastructure/repositories/redis-room.repository.spec.ts` using a mocked `RedisService`.

**Step 2: Run test to verify it fails**
Run: `pnpm test -- src/modules/room/infrastructure/repositories/redis-room.repository.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Implement `RedisRoomRepository` using `RedisService` to store and retrieve serialized JSON strings of `Room` details inside the `lobby:rooms` Redis Hash.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- src/modules/room/infrastructure/repositories/redis-room.repository.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(room): implement RedisRoomRepository"
```

---

### Task 47: Lobby Service

**Files:**
- Create: `src/modules/lobby/application/services/lobby.service.ts`
- Test: `src/modules/lobby/application/services/lobby.service.spec.ts`

**Step 1: Write the failing test**
Create `src/modules/lobby/application/services/lobby.service.spec.ts` to test online status management and fetching active rooms.

**Step 2: Run test to verify it fails**
Run: `pnpm test -- src/modules/lobby/application/services/lobby.service.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `LobbyService` in `src/modules/lobby/application/services/lobby.service.ts`:
- Tracks online players in a Redis Hash `online_players`.
- Exposes methods `setUserOnline`, `setUserOffline`, `getOnlineUsers`, and `getRooms`.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- src/modules/lobby/application/services/lobby.service.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(lobby): implement LobbyService"
```

---

### Task 48: Room & Lobby Gateways

**Files:**
- Create: `src/modules/room/presentation/gateways/room.gateway.ts`
- Create: `src/modules/lobby/presentation/gateways/lobby.gateway.ts`
- Test: `src/modules/room/presentation/gateways/room.gateway.spec.ts`
- Test: `src/modules/lobby/presentation/gateways/lobby.gateway.spec.ts`

**Step 1: Write the failing test**
Create gateway spec files testing connection events, socket room joining, and correct method calls.

**Step 2: Run test to verify it fails**
Run tests for both gateways.
Expected: FAIL

**Step 3: Write minimal implementation**
Implement the Gateways using `@WebSocketGateway` and `@SubscribeMessage`.
- Integrate `WsAuthGuard` for connections.
- Set users online/offline in `LobbyGateway` on connect/disconnect.
- Execute the room use cases and broadcast room updates appropriately.

**Step 4: Run test to verify it passes**
Run gateway tests.
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat(lobby-room): implement Room & Lobby Gateways"
```

---

### Task 49: Module Registration & App Integration

**Files:**
- Create: `src/modules/room/room.module.ts`
- Create: `src/modules/lobby/lobby.module.ts`
- Modify: `src/app.module.ts`

**Step 1: Write the failing test**
*(Skip - config/module changes)*

**Step 2: Run test to verify it fails**
*(Skip)*

**Step 3: Write minimal implementation**
Register providers, controllers, and gateways in `RoomModule` and `LobbyModule`, then import them into `AppModule`.

**Step 4: Run test to verify it passes**
Run `pnpm build` and verify compiling success.

**Step 5: Commit**
```bash
git add .
git commit -m "feat(lobby-room): register modules in AppModule"
```

---

### Task 50: Integration Verification

**Files:**
- None

**Step 1: Write the failing test**
*(Skip)*

**Step 2: Run test to verify it fails**
*(Skip)*

**Step 3: Write minimal implementation**
Ensure database is migrated, tests run and pass.

**Step 4: Run test to verify it passes**
Run `pnpm test` and `pnpm build`.
Expected: All tests pass, build completes.

**Step 5: Commit**
```bash
git add .
git commit -m "chore(lobby-room): final verification of implementation"
```
