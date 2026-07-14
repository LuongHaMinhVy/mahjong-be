# Riichi Declaration Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Implement Riichi declaration support in the Mahjong game loop, complete with checking the closed-hand and Tenpai (ready) conditions.

**Architecture:** Following Clean Architecture layers:
1. **Domain:** Add `isTenpai` check to `RiichiRuleset`.
2. **Application:** Create `DeclareRiichiUseCase`.
3. **Presentation:** Map websocket event `game:riichi` in `GameGateway` to the new use case.

**Tech Stack:** NestJS, TypeScript, Socket.io, Jest.

---

### Task 93: Domain Layer - Add isTenpai helper in RiichiRuleset

**Files:**
- Modify: `src/modules/mahjong/domain/services/riichi.ruleset.ts`
- Create: `src/modules/mahjong/domain/services/riichi.ruleset.spec.ts`

**Step 1: Write the failing test**
Create a test file verifying that a closed hand of 13 tiles is correctly identified as Tenpai or not.
Create `src/modules/mahjong/domain/services/riichi.ruleset.spec.ts`:
```typescript
import { RiichiRuleset } from './riichi.ruleset.js';
import { Tile } from '../value-objects/tile.vo.js';

describe('RiichiRuleset - isTenpai', () => {
  let ruleset: RiichiRuleset;

  beforeEach(() => {
    ruleset = new RiichiRuleset();
  });

  it('should identify a Tenpai hand', () => {
    // Hand waiting for sou-1 (current: sou-2, sou-3) or sou-4
    // 3 Pin sets: pin-1-2-3, pin-4-5-6, pin-7-8-9
    // 1 Man set: man-1-2-3
    // Pair: honor-wind-1 (East) x 2
    const hand = [
      Tile.create('pin', 1, 'number', 'p1'),
      Tile.create('pin', 2, 'number', 'p2'),
      Tile.create('pin', 3, 'number', 'p3'),
      Tile.create('pin', 4, 'number', 'p4'),
      Tile.create('pin', 5, 'number', 'p5'),
      Tile.create('pin', 6, 'number', 'p6'),
      Tile.create('pin', 7, 'number', 'p7'),
      Tile.create('pin', 8, 'number', 'p8'),
      Tile.create('pin', 9, 'number', 'p9'),
      Tile.create('man', 1, 'number', 'm1'),
      Tile.create('man', 2, 'number', 'm2'),
      Tile.create('man', 3, 'number', 'm3'),
      Tile.create('sou', 2, 'number', 's2'),
    ];
    // This hand needs Sou-1 or Sou-3 or Sou-4 depending on the exact composition.
    // Let's create a simpler Tenpai: 4 sets and 1 single waiting tile.
    // 3 sets of Pin: (1,2,3), (4,5,6), (7,8,9) -> 9 tiles
    // 1 set of Man: (1,1,1) -> 3 tiles
    // 1 single tile: Wind-1 -> 1 tile. Waiting for Wind-1 to form a pair.
    const tenpaiHand = [
      Tile.create('pin', 1, 'number', 'p1'),
      Tile.create('pin', 2, 'number', 'p2'),
      Tile.create('pin', 3, 'number', 'p3'),
      Tile.create('pin', 4, 'number', 'p4'),
      Tile.create('pin', 5, 'number', 'p5'),
      Tile.create('pin', 6, 'number', 'p6'),
      Tile.create('pin', 7, 'number', 'p7'),
      Tile.create('pin', 8, 'number', 'p8'),
      Tile.create('pin', 9, 'number', 'p9'),
      Tile.create('man', 1, 'number', 'm1_1'),
      Tile.create('man', 1, 'number', 'm1_2'),
      Tile.create('man', 1, 'number', 'm1_3'),
      Tile.create('honor', 1, 'wind', 'w1'),
    ];

    expect(ruleset.isTenpai(tenpaiHand)).toBe(true);
  });

  it('should return false for a non-Tenpai hand', () => {
    const randomHand = [
      Tile.create('pin', 1, 'number', 'p1'),
      Tile.create('pin', 4, 'number', 'p4'),
      Tile.create('pin', 7, 'number', 'p7'),
      Tile.create('man', 1, 'number', 'm1'),
      Tile.create('man', 4, 'number', 'm4'),
      Tile.create('man', 7, 'number', 'm7'),
      Tile.create('sou', 1, 'number', 's1'),
      Tile.create('sou', 4, 'number', 's4'),
      Tile.create('sou', 7, 'number', 's7'),
      Tile.create('honor', 1, 'wind', 'w1'),
      Tile.create('honor', 2, 'wind', 'w2'),
      Tile.create('honor', 3, 'wind', 'w3'),
      Tile.create('honor', 4, 'wind', 'w4'),
    ];
    expect(ruleset.isTenpai(randomHand)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test src/modules/mahjong/domain/services/riichi.ruleset.spec.ts`
Expected: FAIL (or compilation failure because `isTenpai` does not exist yet)

**Step 3: Write minimal implementation**
Modify `src/modules/mahjong/domain/services/riichi.ruleset.ts`:
Add `isTenpai(hand: Tile[]): boolean` helper method:
```typescript
  isTenpai(hand: Tile[]): boolean {
    if (hand.length !== 13) return false;

    // Generate representatives for all 34 possible distinct tiles
    const candidates: Tile[] = [];
    
    // Man, Pin, Sou
    const suits: ('man' | 'pin' | 'sou')[] = ['man', 'pin', 'sou'];
    for (const suit of suits) {
      for (let val = 1; val <= 9; val++) {
        candidates.push(Tile.create(suit, val, 'number', `cand-${suit}-${val}`));
      }
    }
    
    // Winds
    for (let val = 1; val <= 4; val++) {
      candidates.push(Tile.create('honor', val, 'wind', `cand-wind-${val}`));
    }
    
    // Dragons
    for (let val = 1; val <= 3; val++) {
      candidates.push(Tile.create('honor', val, 'dragon', `cand-dragon-${val}`));
    }

    // Try adding each candidate and check if it forms a winning hand
    for (const cand of candidates) {
      const winResult = this.canWin(hand, cand);
      if (winResult && winResult.isWin) {
        return true;
      }
    }

    return false;
  }
```

**Step 4: Run test to verify it passes**
Run: `pnpm test src/modules/mahjong/domain/services/riichi.ruleset.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/modules/mahjong/domain/services/riichi.ruleset.ts src/modules/mahjong/domain/services/riichi.ruleset.spec.ts
git commit -m "feat(mahjong): implement isTenpai check in RiichiRuleset"
```

---

### Task 94: Application Layer - Create DeclareRiichiUseCase

**Files:**
- Create: `src/modules/mahjong/application/use-cases/declare-riichi.use-case.ts`
- Create: `src/modules/mahjong/application/use-cases/declare-riichi.use-case.spec.ts`

**Step 1: Write the failing test**
Create `src/modules/mahjong/application/use-cases/declare-riichi.use-case.spec.ts` verifying closed hand requirements, point checks, Tenpai verification, point deduction, and action logging.

**Step 2: Run test to verify it fails**
Run: `pnpm test src/modules/mahjong/application/use-cases/declare-riichi.use-case.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `src/modules/mahjong/application/use-cases/declare-riichi.use-case.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { GameEngine } from '../../domain/services/game-engine.js';
import { RiichiRuleset } from '../../domain/services/riichi.ruleset.js';
import { IGameStateRepository } from '../../domain/repositories/game-state.repository.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export interface DeclareRiichiDto {
  gameId: string;
  playerId: string;
  tileId: string;
}

@Injectable()
export class DeclareRiichiUseCase {
  constructor(private readonly gameStateRepository: IGameStateRepository) {}

  async execute(dto: DeclareRiichiDto): Promise<void> {
    const state = await this.gameStateRepository.findById(dto.gameId);
    if (!state) {
      throw new DomainException('NOT_FOUND', 'Game not found.');
    }

    if (state.rulesetName !== 'riichi') {
      throw new DomainException('VALIDATION_ERROR', 'Riichi can only be declared in Riichi ruleset.');
    }

    if (state.phase !== 'playing') {
      throw new DomainException('VALIDATION_ERROR', 'Game is not in playing phase.');
    }

    const player = state.getCurrentPlayer();
    if (player.userId !== dto.playerId) {
      throw new DomainException('VALIDATION_ERROR', 'It is not your turn.');
    }

    if (player.isRiichi) {
      throw new DomainException('VALIDATION_ERROR', 'You have already declared Riichi.');
    }

    if (player.score < 1000) {
      throw new DomainException('VALIDATION_ERROR', 'Not enough points to declare Riichi.');
    }

    // Closed hand check: all melds must be concealed
    const isOpen = player.melds.some((m) => !m.isConcealed);
    if (isOpen) {
      throw new DomainException('VALIDATION_ERROR', 'Cannot declare Riichi with an open hand.');
    }

    const tileIndex = player.hand.findIndex((t) => t.id === dto.tileId);
    if (tileIndex === -1) {
      throw new DomainException('NOT_FOUND', 'Tile not found in hand.');
    }

    // Tenpai check on remaining 13 tiles after removing the chosen discard
    const tempHand = [...player.hand];
    const [discardedTile] = tempHand.splice(tileIndex, 1);
    
    const ruleset = new RiichiRuleset();
    const isTenpai = ruleset.isTenpai(tempHand);
    if (!isTenpai) {
      throw new DomainException('VALIDATION_ERROR', 'Hand is not in Tenpai after this discard.');
    }

    // Deduct 1000 points
    player.score -= 1000;
    player.isRiichi = true;

    // Add riichi action to history
    state.addAction(dto.playerId, 'riichi', discardedTile);

    // Call game engine discard to process the actual discard and advance turn
    const engine = new GameEngine(ruleset);
    engine.discardTile(state, dto.playerId, dto.tileId);

    // Save state
    await this.gameStateRepository.save(state);
  }
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test src/modules/mahjong/application/use-cases/declare-riichi.use-case.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/modules/mahjong/application/use-cases/declare-riichi.use-case.ts src/modules/mahjong/application/use-cases/declare-riichi.use-case.spec.ts
git commit -m "feat(mahjong): implement DeclareRiichiUseCase"
```

---

### Task 95: Presentation Layer - Implement game:riichi event in GameGateway

**Files:**
- Modify: `src/modules/mahjong/presentation/websocket/game.gateway.ts`

**Step 1: Write the minimal implementation**
Inject `DeclareRiichiUseCase` in `GameGateway` and add the `@SubscribeMessage('game:riichi')` event handler:
```typescript
  @UseGuards(WsAuthGuard)
  @SubscribeMessage('game:riichi')
  async handleDeclareRiichi(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { gameId: string; tileId: string },
  ) {
    const userId = client.user.sub;
    try {
      await this.declareRiichiUseCase.execute({
        gameId: data.gameId,
        playerId: userId,
        tileId: data.tileId,
      });
      const state = await this.gameStateRepository.findById(data.gameId);
      if (!state) {
        throw new Error('Game state not found after declaring Riichi');
      }
      await this.broadcastGameState(data.gameId, state);
    } catch (err: any) {
      this.logger.error(`Declare Riichi failed: ${err.message}`);
      client.emit('error', err.message);
    }
  }
```

**Step 2: Run build to verify compilation**
Run: `pnpm build`
Expected: PASS

**Step 3: Commit**
```bash
git add src/modules/mahjong/presentation/websocket/game.gateway.ts
git commit -m "feat(mahjong): wire game:riichi event in GameGateway"
```

---

### Task 96: Module Registration - Register DeclareRiichiUseCase

**Files:**
- Modify: `src/modules/mahjong/mahjong.module.ts`

**Step 1: Write the minimal implementation**
Import and register `DeclareRiichiUseCase` inside `MahjongModule`'s `USE_CASES`, providers, and exports.

**Step 2: Run build and verify**
Run: `pnpm build`
Expected: PASS

**Step 3: Commit**
```bash
git add src/modules/mahjong/mahjong.module.ts
git commit -m "feat(mahjong): register DeclareRiichiUseCase in MahjongModule"
```

---

### Task 97: Final Verification & Test Cleanup

**Files:**
- Modify: `docs/04-Development/task.md`
- Delete: `src/modules/mahjong/domain/services/riichi.ruleset.spec.ts`
- Delete: `src/modules/mahjong/application/use-cases/declare-riichi.use-case.spec.ts`

**Step 1: Run complete build and test suite**
Run: `pnpm build && pnpm test`
Expected: SUCCESS & all tests PASS.

**Step 2: Cleanup temporary unit test files**
Remove the created `.spec.ts` files to keep the workspace clean as requested:
Run: `git rm src/modules/mahjong/domain/services/riichi.ruleset.spec.ts src/modules/mahjong/application/use-cases/declare-riichi.use-case.spec.ts`

**Step 3: Final commit**
```bash
git commit -m "test(mahjong): final verification and temporary test cleanup for Riichi declaration"
```
