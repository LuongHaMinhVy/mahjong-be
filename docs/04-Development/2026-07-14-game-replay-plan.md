# Game Replay System Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Implement a Game Replay System that captures all game actions (draw, discard, claim, win) and stores them in PostgreSQL as an aggregated JSON sequence, exposing a REST API for clients to retrieve the replay, with all written tests deleted after verification.

**Architecture:** Append `actions` history to the Redis-cached `GameState` during the match. When the match ends via `DeclareWinUseCase`, persist the aggregated actions to a `GameReplay` table in PostgreSQL. Expose `GET /api/games/:gameResultId/replay` via NestJS Controller.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Redis, Jest

---

## Plan Tasks

### Task 85: Database Schema Update
**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Update Prisma schema**
Modify `prisma/schema.prisma` to add `GameReplay` and link it to `GameResult`:
```prisma
model GameResult {
  id          String       @id @default(uuid())
  roomId      String       @map("room_id")
  rulesetName String       @map("ruleset_name")
  winnerId    String?      @map("winner_id")
  playersJson Json         @map("players_json")
  createdAt   DateTime     @default(now()) @map("created_at")
  
  winner      User?        @relation("WinnerRelation", fields: [winnerId], references: [id])
  replay      GameReplay?

  @@map("game_results")
}

model GameReplay {
  id           String     @id @default(uuid())
  gameResultId String     @unique @map("game_result_id")
  actionsJson  Json       @map("actions_json")
  createdAt    DateTime   @default(now()) @map("created_at")
  
  gameResult   GameResult @relation(fields: [gameResultId], references: [id], onDelete: Cascade)

  @@map("game_replays")
}
```

**Step 2: Generate Prisma migration**
Run the migration command:
```powershell
pnpm prisma migrate dev --name add_game_replays
```
Expected: SUCCESS

**Step 3: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat(db): add game_replays model to schema"
```

---

### Task 86: Domain Layer - GameState Update
**Files:**
- Modify: `src/modules/mahjong/domain/entities/game-state.entity.ts`
- Create (Temporary): `src/modules/mahjong/domain/entities/game-state.entity.spec.ts`

**Step 1: Write the failing test**
Create `src/modules/mahjong/domain/entities/game-state.entity.spec.ts`:
```typescript
import { GameState } from './game-state.entity.js';
import { Tile } from '../value-objects/tile.vo.js';

describe('GameState Replay Actions', () => {
  it('should add actions to game state correctly', () => {
    const state = new GameState('g1', 'r1', 'riichi', 'playing', [], 0, []);
    expect(state.actions.length).toBe(0);
    
    const tile = Tile.create('man', 1, 'number', 't1');
    state.addAction('u1', 'discard', tile);
    
    expect(state.actions.length).toBe(1);
    expect(state.actions[0].type).toBe('discard');
    expect(state.actions[0].playerId).toBe('u1');
    expect(state.actions[0].tile?.id).toBe('t1');
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=game-state.entity.spec.ts`
Expected: FAIL (actions does not exist)

**Step 3: Write minimal implementation**
Modify `src/modules/mahjong/domain/entities/game-state.entity.ts`:
Add import:
```typescript
import { GameAction, GameActionType } from '../value-objects/game-action.vo.js';
```
Add field and helper:
```typescript
  public actions: GameAction[] = [];
  
  addAction(playerId: string, type: GameActionType, tile?: Tile, extra?: any): void {
    this.actions.push({
      sequence: this.actions.length,
      playerId,
      type,
      tile: tile ? { suit: tile.suit, value: tile.value, type: tile.type, id: tile.id } : undefined,
      extra,
      timestamp: Date.now(),
    });
  }
```
Create VO definition file: `src/modules/mahjong/domain/value-objects/game-action.vo.ts`:
```typescript
export type GameActionType = 
  | 'deal'
  | 'draw'
  | 'discard'
  | 'chi'
  | 'pon'
  | 'kan'
  | 'riichi'
  | 'tsumo'
  | 'ron';

export interface GameAction {
  sequence: number;
  playerId: string;
  type: GameActionType;
  tile?: {
    suit: string;
    value: number;
    type: string;
    id: string;
  };
  extra?: any;
  timestamp: number;
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=game-state.entity.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/modules/mahjong/domain/entities/game-state.entity.ts src/modules/mahjong/domain/value-objects/game-action.vo.ts
git commit -m "feat(mahjong): add action tracking properties to GameState entity"
```

---

### Task 87: Infrastructure Layer - Redis Repository Update
**Files:**
- Modify: `src/modules/mahjong/infrastructure/repositories/redis-game-state.repository.ts`

**Step 1: Update reconstruction logic**
Modify `src/modules/mahjong/infrastructure/repositories/redis-game-state.repository.ts` inside `reconstructGameState(raw)`:
```typescript
  private reconstructGameState(raw: any): GameState {
    const state = new GameState(
      raw.id,
      raw.roomId,
      raw.rulesetName,
      raw.phase,
      raw.wall.map((t: any) => this.reconstructTile(t)),
      raw.currentTurn,
      raw.players.map((p: any) => this.reconstructPlayerState(p)),
      raw.round,
      raw.honba,
      raw.dora ? raw.dora.map((t: any) => this.reconstructTile(t)) : [],
      raw.discardPile
        ? raw.discardPile.map((pile: any[]) =>
            pile.map((t: any) => this.reconstructTile(t)),
          )
        : [[], [], [], []],
    );

    state.actions = raw.actions ? raw.actions.map((act: any) => ({
      sequence: act.sequence,
      playerId: act.playerId,
      type: act.type,
      tile: act.tile ? this.reconstructTile(act.tile) : undefined,
      extra: act.extra,
      timestamp: act.timestamp,
    })) : [];

    return state;
  }
```

**Step 2: Verify existing tests pass**
Run: `pnpm test`
Expected: PASS

**Step 3: Commit**
```bash
git add src/modules/mahjong/infrastructure/repositories/redis-game-state.repository.ts
git commit -m "feat(mahjong): support action history in RedisGameStateRepository serialization"
```

---

### Task 88: Domain & Infrastructure Layer - GameReplay Repository
**Files:**
- Create: `src/modules/mahjong/domain/repositories/game-replay.repository.ts`
- Create: `src/modules/mahjong/infrastructure/repositories/prisma-game-replay.repository.ts`

**Step 1: Define port interface**
Create `src/modules/mahjong/domain/repositories/game-replay.repository.ts`:
```typescript
import { GameAction } from '../value-objects/game-action.vo.js';

export interface GameReplay {
  id: string;
  gameResultId: string;
  actions: GameAction[];
  createdAt: Date;
}

export abstract class IGameReplayRepository {
  abstract save(gameResultId: string, actions: GameAction[]): Promise<GameReplay>;
  abstract findByGameResultId(gameResultId: string): Promise<GameReplay | null>;
}
```

**Step 2: Implement adapter**
Create `src/modules/mahjong/infrastructure/repositories/prisma-game-replay.repository.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { IGameReplayRepository, GameReplay } from '../../domain/repositories/game-replay.repository.js';
import { GameAction } from '../../domain/value-objects/game-action.vo.js';

@Injectable()
export class PrismaGameReplayRepository implements IGameReplayRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(gameResultId: string, actions: GameAction[]): Promise<GameReplay> {
    const record = await this.prisma.gameReplay.create({
      data: {
        gameResultId,
        actionsJson: JSON.parse(JSON.stringify(actions)),
      },
    });
    return {
      id: record.id,
      gameResultId: record.gameResultId,
      actions: record.actionsJson as unknown as GameAction[],
      createdAt: record.createdAt,
    };
  }

  async findByGameResultId(gameResultId: string): Promise<GameReplay | null> {
    const record = await this.prisma.gameReplay.findUnique({
      where: { gameResultId },
    });
    if (!record) return null;
    return {
      id: record.id,
      gameResultId: record.gameResultId,
      actions: record.actionsJson as unknown as GameAction[],
      createdAt: record.createdAt,
    };
  }
}
```

**Step 3: Commit**
```bash
git add src/modules/mahjong/domain/repositories/game-replay.repository.ts src/modules/mahjong/infrastructure/repositories/prisma-game-replay.repository.ts
git commit -m "feat(mahjong): add GameReplay repository port and Prisma adapter"
```

---

### Task 89: Application Layer - Update Game Use Cases to Record Actions
**Files:**
- Modify: `src/modules/mahjong/application/use-cases/start-game.use-case.ts`
- Modify: `src/modules/mahjong/application/use-cases/draw-tile.use-case.ts`
- Modify: `src/modules/mahjong/application/use-cases/discard-tile.use-case.ts`
- Modify: `src/modules/mahjong/application/use-cases/claim-meld.use-case.ts`
- Modify: `src/modules/mahjong/application/use-cases/declare-win.use-case.ts`

**Step 1: Update StartGameUseCase**
Modify `start-game.use-case.ts` to record 'deal' action containing all players' initial hands:
```typescript
    // After hands dealing is completed
    const handsRepresentation = state.players.reduce((acc, p) => {
      acc[p.userId] = p.hand.map(t => ({ suit: t.suit, value: t.value, type: t.type, id: t.id }));
      return acc;
    }, {} as Record<string, any>);
    
    state.addAction('system', 'deal', undefined, { hands: handsRepresentation });
```

**Step 2: Update DrawTileUseCase**
Modify `draw-tile.use-case.ts` to record 'draw' action:
```typescript
    // After drawing tile
    const tile = player.hand[player.hand.length - 1];
    state.addAction(dto.playerId, 'draw', tile);
```

**Step 3: Update DiscardTileUseCase**
Modify `discard-tile.use-case.ts` to record 'discard' action:
```typescript
    // Locate tile discarded and call addAction
    state.addAction(dto.playerId, 'discard', tile);
```

**Step 4: Update ClaimMeldUseCase**
Modify `claim-meld.use-case.ts` to record chi/pon/kan:
```typescript
    // After meld is formed
    state.addAction(dto.playerId, dto.meldType as any, dto.tile, { meldTiles: dto.meldTiles });
```

**Step 5: Update DeclareWinUseCase**
Modify `declare-win.use-case.ts` to:
- Record tsumo/ron.
- Save replay using `IGameReplayRepository.save`.
Add import:
```typescript
import { IGameReplayRepository } from '../../domain/repositories/game-replay.repository.js';
```
Inject `gameReplayRepository: IGameReplayRepository` in constructor.
Inside `execute`:
```typescript
    // Record win action
    state.addAction(dto.playerId, dto.isSelfDraw ? 'tsumo' : 'ron', winningTile ?? undefined);
    
    // Save Game Result and Replay
    const gameResult = new GameResult(...);
    await this.gameResultRepository.save(gameResult);
    await this.gameReplayRepository.save(gameResult.id, state.actions);
```

**Step 6: Commit**
```bash
git add src/modules/mahjong/application/use-cases
git commit -m "feat(mahjong): integrate action tracking into game play use cases"
```

---

### Task 90: Application & Presentation Layer - GetGameReplay
**Files:**
- Create: `src/modules/mahjong/application/use-cases/get-game-replay.use-case.ts`
- Create: `src/modules/mahjong/presentation/controllers/game-replay.controller.ts`
- Create (Temporary): `src/modules/mahjong/presentation/controllers/game-replay.controller.spec.ts`

**Step 1: Implement GetGameReplayUseCase**
Create `src/modules/mahjong/application/use-cases/get-game-replay.use-case.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { IGameReplayRepository, GameReplay } from '../../domain/repositories/game-replay.repository.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

@Injectable()
export class GetGameReplayUseCase {
  constructor(private readonly gameReplayRepository: IGameReplayRepository) {}

  async execute(gameResultId: string): Promise<GameReplay> {
    const replay = await this.gameReplayRepository.findByGameResultId(gameResultId);
    if (!replay) {
      throw new DomainException('NOT_FOUND', 'Game replay not found.');
    }
    return replay;
  }
}
```

**Step 2: Implement GameReplayController**
Create `src/modules/mahjong/presentation/controllers/game-replay.controller.ts`:
```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GetGameReplayUseCase } from '../../application/use-cases/get-game-replay.use-case.js';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard.js';

@Controller('games')
export class GameReplayController {
  constructor(private readonly getGameReplayUseCase: GetGameReplayUseCase) {}

  @Get(':gameResultId/replay')
  @UseGuards(JwtAuthGuard)
  async getReplay(@Param('gameResultId') gameResultId: string) {
    const replay = await this.getGameReplayUseCase.execute(gameResultId);
    return {
      gameResultId: replay.gameResultId,
      actions: replay.actions,
      createdAt: replay.createdAt,
    };
  }
}
```

**Step 3: Write the failing Controller unit test**
Create `src/modules/mahjong/presentation/controllers/game-replay.controller.spec.ts` verifying API response structure and mock behavior.

**Step 4: Run tests**
Run: `pnpm test -- --testPathPattern=game-replay.controller.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/modules/mahjong/application/use-cases/get-game-replay.use-case.ts src/modules/mahjong/presentation/controllers/game-replay.controller.ts
git commit -m "feat(mahjong): implement get replay use case and REST API endpoint"
```

---

### Task 91: Module Registration
**Files:**
- Modify: `src/modules/mahjong/mahjong.module.ts`

**Step 1: Register components**
Modify `src/modules/mahjong/mahjong.module.ts`:
Import `IGameReplayRepository`, `PrismaGameReplayRepository`, `GetGameReplayUseCase`, `GameReplayController`.
Add providers:
```typescript
    {
      provide: IGameReplayRepository,
      useClass: PrismaGameReplayRepository,
    },
    GetGameReplayUseCase,
```
Add controller:
```typescript
  controllers: [GameReplayController],
```
Add export:
```typescript
  exports: [
    IGameReplayRepository,
    ...USE_CASES,
    GetGameReplayUseCase,
    GameGateway,
  ],
```

**Step 2: Verify project builds**
Run: `pnpm build`
Expected: SUCCESS

**Step 3: Commit**
```bash
git add src/modules/mahjong/mahjong.module.ts
git commit -m "feat(mahjong): register GameReplay components in MahjongModule"
```

---

### Task 92: Final Verification & Test Cleanup
**Files:**
- Delete: All newly created `.spec.ts` files.

**Step 1: Run all test suites**
Run: `pnpm test`
Expected: PASS

**Step 2: Delete spec files**
Delete the temporary spec files created in this plan:
- `src/modules/mahjong/domain/entities/game-state.entity.spec.ts`
- `src/modules/mahjong/presentation/controllers/game-replay.controller.spec.ts`

**Step 3: Run all test suites again**
Run: `pnpm test`
Expected: PASS (8 test suites, 17 tests passed)

**Step 4: Verify the project builds cleanly**
Run: `pnpm build`
Expected: SUCCESS

**Step 5: Commit**
```bash
git add .
git commit -m "test(cleanup): remove local spec files after successful verification"
```
