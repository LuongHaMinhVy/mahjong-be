# Game Replay System Design

## Overview
This feature tracks all user moves and actions (draws, discards, claims, wins) during a Mahjong game (both Riichi and Chinese Classical) and stores them as an aggregated JSON sequence. This allows players to retrieve and play back the entire match step-by-step.

## Architectural Decision
- **Storage Strategy:** Actions are appended to the `GameState` and cached in Redis during the game to avoid frequent database writes. Once the game ends (via `DeclareWin`), the complete sequence of actions is persisted as a single aggregated record in a dedicated `GameReplay` PostgreSQL table.
- **Cleanup Policy:** All unit/integration tests will be written and run locally to verify correct implementation, then deleted upon task completion per the developer's request.

## Database Schema (`prisma/schema.prisma`)
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

## Domain Logic & State Definition

### 1. GameAction Interface
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

### 2. GameState Modification
Add `actions: GameAction[] = []` field and `addAction(playerId: string, type: GameActionType, tile?: Tile, extra?: any): void` helper method to the `GameState` entity.

## Layers & Classes

- **Domain Port:** `src/modules/mahjong/domain/repositories/game-replay.repository.ts`
  - Defines `IGameReplayRepository` interface.
- **Infrastructure Adapter:** `src/modules/mahjong/infrastructure/repositories/prisma-game-replay.repository.ts`
  - Implements database read/write.
- **Application Use Cases:**
  - `DeclareWinUseCase`: Generates and persists the `GameReplay` object.
  - `GetGameReplayUseCase`: Resolves a game replay by `gameResultId`.
- **Presentation Controller:**
  - `GET /api/games/:gameResultId/replay` mapped to `GameReplayController`.
