# Mahjong Game Logic Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Implement the Mahjong game logic module supporting both Riichi Mahjong (Japan, 13-tile hand) and Chinese Classical Mahjong (China, 16-tile hand) rulesets with Strategy Pattern and Clean Architecture.

**Architecture:** We use the Strategy Pattern where a core `GameEngine` delegates ruleset-specific rules (valid tiles, hand sizing, moves validator, winning conditions, and scoring) to implementations of `IRuleset`. State is stored in Redis (hot game state) and results are persisted in PostgreSQL.

**Tech Stack:** NestJS, TypeScript, Prisma, Redis, Socket.io (WebSocket), Jest.

---

## Plan Tasks

### Task 25: Domain Layer — Tile and Meld Value Objects
**Files:**
- Create: `src/modules/mahjong/domain/value-objects/tile.vo.ts`
- Create: `src/modules/mahjong/domain/value-objects/meld.vo.ts`
- Test: `src/modules/mahjong/domain/value-objects/tile.vo.spec.ts`

**Step 1: Write the failing test**
Create `src/modules/mahjong/domain/value-objects/tile.vo.spec.ts` testing tile equality, validation, and serialization.
```typescript
import { Tile } from './tile.vo.js';

describe('Tile Value Object', () => {
  it('should create a valid tile and verify equality', () => {
    const tile1 = Tile.create('man', 1, 'number', '1');
    const tile2 = Tile.create('man', 1, 'number', '2');
    const tile3 = Tile.create('pin', 1, 'number', '3');
    expect(tile1.equals(tile2)).toBe(true);
    expect(tile1.equals(tile3)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=tile.vo.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Write `src/modules/mahjong/domain/value-objects/tile.vo.ts` and `meld.vo.ts`.
`tile.vo.ts`:
```typescript
export type TileSuit = 'man' | 'pin' | 'sou' | 'honor' | 'flower';
export type TileType = 'number' | 'wind' | 'dragon' | 'flower' | 'season';

export class Tile {
  private constructor(
    readonly suit: TileSuit,
    readonly value: number,
    readonly type: TileType,
    readonly id: string,
  ) {}

  static create(suit: TileSuit, value: number, type: TileType, id: string): Tile {
    return new Tile(suit, value, type, id);
  }

  equals(other: Tile): boolean {
    return this.suit === other.suit && this.value === other.value;
  }
}
```
`meld.vo.ts`:
```typescript
import { Tile } from './tile.vo.js';

export type MeldType = 'chi' | 'pon' | 'kan' | 'closed-kan';

export class Meld {
  constructor(
    readonly type: MeldType,
    readonly tiles: Tile[],
    readonly isConcealed: boolean,
  ) {}
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=tile.vo.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/modules/mahjong/domain/value-objects
git commit -m "feat(mahjong): add Tile and Meld value objects"
```

---

### Task 26: Domain Layer — IRuleset Port
**Files:**
- Create: `src/modules/mahjong/domain/services/ruleset.interface.ts`
- Create: `src/modules/mahjong/domain/value-objects/ruleset-types.ts`

**Step 1: Write the interface definition**
Define the `IRuleset` abstract class and related result interfaces in `src/modules/mahjong/domain/services/ruleset.interface.ts`.
```typescript
import { Tile } from '../value-objects/tile.vo.js';
import { Meld } from '../value-objects/meld.vo.js';

export interface WinResult {
  isWin: boolean;
  yakuNames?: string[];
  fanNames?: string[];
  fanCount?: number;
  han?: number;
  fu?: number;
}

export interface ScoreResult {
  winnerId: string;
  points: number;
  scoreMap: Record<string, number>; // userId -> point change
}

export abstract class IRuleset {
  abstract readonly name: 'riichi' | 'chinese';
  abstract readonly initialHandSize: number;
  abstract buildTileSet(): Tile[];
  abstract canChi(hand: Tile[], tile: Tile, fromPosition: number): boolean;
  abstract canPon(hand: Tile[], tile: Tile): boolean;
  abstract canKan(hand: Tile[], tile: Tile): boolean;
  abstract canWin(hand: Tile[], tile: Tile | null): WinResult | null;
}
```

**Step 2: Commit**
```bash
git add src/modules/mahjong/domain/services/ruleset.interface.ts
git commit -m "feat(mahjong): define IRuleset port interface"
```

---

### Task 27: Domain Layer — GameState and PlayerState Entities
**Files:**
- Create: `src/modules/mahjong/domain/entities/game-state.entity.ts`
- Test: `src/modules/mahjong/domain/entities/game-state.entity.spec.ts`

**Step 1: Write the failing test**
Create `src/modules/mahjong/domain/entities/game-state.entity.spec.ts` testing state creation and player hands initialization.

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=game-state.entity.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `src/modules/mahjong/domain/entities/game-state.entity.ts`:
```typescript
import { Tile } from '../value-objects/tile.vo.js';
import { Meld } from '../value-objects/meld.vo.js';

export interface PlayerState {
  userId: string;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  score: number;
  isRiichi: boolean;
}

export class GameState {
  constructor(
    readonly id: string,
    readonly roomId: string,
    readonly rulesetName: 'riichi' | 'chinese',
    public phase: 'dealing' | 'playing' | 'scoring' | 'finished',
    public wall: Tile[],
    public currentTurn: number,
    public players: PlayerState[],
    public round: number = 0,
    public honba: number = 0,
    public dora: Tile[] = [],
    public discardPile: Tile[][] = [[], [], [], []],
  ) {}
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=game-state.entity.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/modules/mahjong/domain/entities
git commit -m "feat(mahjong): create GameState and PlayerState domain entities"
```

---

### Task 28: Domain Layer — GameEngine Core Service
**Files:**
- Create: `src/modules/mahjong/domain/services/game-engine.service.ts`
- Test: `src/modules/mahjong/domain/services/game-engine.service.spec.ts`

**Step 1: Write the failing test**
Create `src/modules/mahjong/domain/services/game-engine.service.spec.ts` verifying game initialization, deal, draw, and discard.

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=game-engine.service.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Implement pure game logic flow control in `src/modules/mahjong/domain/services/game-engine.service.ts` delegating validation & generation to the ruleset instance.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=game-engine.service.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/modules/mahjong/domain/services/game-engine.service.ts
git commit -m "feat(mahjong): implement core GameEngine domain service"
```

---

### Task 29: Infrastructure Layer — RiichiRuleset Implementation
**Files:**
- Create: `src/modules/mahjong/infrastructure/rulesets/riichi/riichi.ruleset.ts`
- Create: `src/modules/mahjong/infrastructure/rulesets/riichi/riichi-yaku.ts`
- Create: `src/modules/mahjong/infrastructure/rulesets/riichi/riichi-score.ts`
- Test: `src/modules/mahjong/infrastructure/rulesets/riichi/riichi.ruleset.spec.ts`

**Step 1: Write the failing test**
Create test checking `riichi.ruleset.ts` properly parses 136-tile base sets and calculates basic Yaku hands (e.g., Tanyao, Pinfu).

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=riichi.ruleset.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Implement Yaku checker, Fu calculation, Han calculation, and ruleset rules inside `src/modules/mahjong/infrastructure/rulesets/riichi/`.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=riichi.ruleset.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/modules/mahjong/infrastructure/rulesets/riichi
git commit -m "feat(mahjong): implement Riichi ruleset with Yaku and Han/Fu scoring"
```

---

### Task 30: Infrastructure Layer — ChineseRuleset Implementation
**Files:**
- Create: `src/modules/mahjong/infrastructure/rulesets/chinese/chinese.ruleset.ts`
- Create: `src/modules/mahjong/infrastructure/rulesets/chinese/chinese-fan.ts`
- Create: `src/modules/mahjong/infrastructure/rulesets/chinese/chinese-score.ts`
- Test: `src/modules/mahjong/infrastructure/rulesets/chinese/chinese.ruleset.spec.ts`

**Step 1: Write the failing test**
Create test checking `chinese.ruleset.ts` with 144 tiles (including flower/season tiles) and checking top 20 fan scoring.

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=chinese.ruleset.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Implement 144-tile deck build, and top 20 fan scoring formulas in `src/modules/mahjong/infrastructure/rulesets/chinese/`.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=chinese.ruleset.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/modules/mahjong/infrastructure/rulesets/chinese
git commit -m "feat(mahjong): implement Chinese Classical ruleset with 144 tiles and fan scoring"
```

---

### Task 31: Domain & Infrastructure Layer — Repositories and Prisma Setup
**Files:**
- Create: `src/modules/mahjong/domain/repositories/game-state.repository.ts`
- Create: `src/modules/mahjong/domain/repositories/game-result.repository.ts`
- Create: `src/modules/mahjong/infrastructure/repositories/redis-game-state.repository.ts`
- Create: `src/modules/mahjong/infrastructure/repositories/prisma-game-result.repository.ts`
- Modify: `prisma/schema.prisma`

**Step 1: Update Prisma schema**
Add `GameResult` model to `prisma/schema.prisma`.
Run Prisma migration to apply changes:
```bash
pnpm prisma migrate dev --name add_game_results
```

**Step 2: Implement Redis and Prisma Repository adapters**
Write state read/write mapping logic, session caching inside `infrastructure/repositories/`.

**Step 3: Commit**
```bash
git add prisma/schema.prisma src/modules/mahjong/domain/repositories src/modules/mahjong/infrastructure/repositories
git commit -m "feat(mahjong): implement Redis and Prisma repositories for state and results"
```

---

### Task 32: Application Layer — StartGame & Game Moves Use Cases
**Files:**
- Create: `src/modules/mahjong/application/use-cases/start-game.use-case.ts`
- Create: `src/modules/mahjong/application/use-cases/draw-tile.use-case.ts`
- Create: `src/modules/mahjong/application/use-cases/discard-tile.use-case.ts`
- Create: `src/modules/mahjong/application/use-cases/claim-tile.use-case.ts`
- Create: `src/modules/mahjong/application/use-cases/declare-win.use-case.ts`
- Test: `src/modules/mahjong/application/use-cases/use-cases.spec.ts`

**Step 1: Write the failing tests**
Create unit/integration test suites checking coordination between rulesets, repositories, and ELO calculations.

**Step 2: Run test to verify it fails**
Run: `pnpm test -- --testPathPattern=use-cases.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Implement all use cases in `src/modules/mahjong/application/use-cases/`.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- --testPathPattern=use-cases.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/modules/mahjong/application/use-cases
git commit -m "feat(mahjong): implement core application use cases"
```

---

### Task 33: Presentation Layer — WebSocket Gateway & Module Registration
**Files:**
- Create: `src/modules/mahjong/presentation/websocket/game.gateway.ts`
- Modify: `src/modules/mahjong/mahjong.module.ts`
- Modify: `src/app.module.ts`

**Step 1: Create WebSocket Gateway**
Create `src/modules/mahjong/presentation/websocket/game.gateway.ts` to handle client connection, room state subscription, game events (`game:draw`, `game:discard`, `game:claim`, `game:win`, `game:skip`).

**Step 2: Register in MahjongModule and AppModule**
Include gateway, repositories, rulesets, and use cases in `MahjongModule`. Include `MahjongModule` in `AppModule`.

**Step 3: Verify the application builds**
Run: `pnpm build`
Expected: SUCCESS

**Step 4: Commit**
```bash
git add src/modules/mahjong src/app.module.ts
git commit -m "feat(mahjong): wire up WebSocket gateway and register module"
```
