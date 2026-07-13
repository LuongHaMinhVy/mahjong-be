# Thiết kế Hệ thống: Mahjong Game Logic Module

## 1. Tổng quan

Tài liệu này mô tả thiết kế module Game Logic cho dự án Mahjong Online.
Module này xử lý toàn bộ nghiệp vụ game: chia bài, lượt chơi, ăn/cúp, hú, tính điểm.

## 2. Mục tiêu & Phạm vi MVP

### Hỗ trợ:
- **Riichi Mahjong (Nhật):** 13 quân trên tay, 136 quân, full yaku scoring (Han/Fu)
- **Chinese Classical (Trung):** 16 quân trên tay, 144 quân (thêm hoa/mùa), top 20 fan scoring

### Không làm trong MVP:
- AI Bot (sẽ bổ sung sau dưới dạng module độc lập)
- Replay ván đấu
- Spectator mode
- Tournament bracket

## 3. Kiến trúc — Strategy Pattern + Clean Architecture

### Lý do chọn Strategy Pattern:
Mỗi ruleset implement interface `IRuleset` riêng. Thêm luật thứ 3 chỉ cần thêm 1 class mới, không sửa code cũ (Open/Closed Principle).

## 4. Domain Layer

### 4.1 Tile (Value Object)
Bộ quân dùng chung, mỗi ruleset tự chọn subset cần dùng:

```typescript
type TileSuit = 'man' | 'pin' | 'sou' | 'honor' | 'flower';
type TileType = 'number' | 'wind' | 'dragon' | 'flower' | 'season';

class Tile {
  readonly suit: TileSuit;
  readonly value: number;   // 1-9 (số), 1-4 (gió/rồng/hoa)
  readonly type: TileType;
  readonly id: string;      // unique per instance (e.g. 'man-1-a')
}
```

- **Riichi:** man/pin/sou/honor → 136 quân
- **Chinese:** thêm flower/season → 144 quân

### 4.2 Meld (Value Object)
```typescript
type MeldType = 'chi' | 'pon' | 'kan' | 'closed-kan';
class Meld {
  readonly type: MeldType;
  readonly tiles: Tile[];
  readonly isConcealed: boolean;
}
```

### 4.3 IRuleset (Domain Port — Strategy Interface)
```typescript
abstract class IRuleset {
  abstract readonly name: 'riichi' | 'chinese';
  abstract readonly initialHandSize: number;    // Riichi=13, Chinese=16
  abstract buildTileSet(): Tile[];
  abstract canChi(hand: Hand, tile: Tile, fromPosition: number): boolean;
  abstract canPon(hand: Hand, tile: Tile): boolean;
  abstract canKan(hand: Hand, tile: Tile): boolean;
  abstract canWin(hand: Hand, tile: Tile | null): WinResult | null;
  abstract calculateScore(win: WinResult, context: GameContext): ScoreResult;
}
```

### 4.4 GameState (Aggregate Root)
```typescript
class GameState {
  readonly id: string;
  readonly roomId: string;
  readonly ruleset: 'riichi' | 'chinese';
  phase: 'dealing' | 'playing' | 'scoring' | 'finished';
  wall: Tile[];
  currentTurn: number;          // 0-3
  players: PlayerState[];
  round: number;                // vòng (East 1, East 2...)
  honba: number;                // bonus counter (Riichi)
  dora: Tile[];                 // dora indicators (Riichi)
  discardPile: Tile[][];        // discard của từng player
}

interface PlayerState {
  userId: string;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  score: number;
  isRiichi: boolean;            // Riichi only
}
```

### 4.5 GameEngine (Domain Service)
Pure functions, không phụ thuộc NestJS/Prisma/Redis:

```typescript
class GameEngine {
  startGame(ruleset: IRuleset, playerIds: string[]): GameState
  drawTile(state: GameState): GameState
  discardTile(state: GameState, playerId: string, tile: Tile): GameState
  claimTile(state: GameState, playerId: string, action: ClaimAction): GameState
  declareWin(state: GameState, playerId: string): { state: GameState; result: ScoreResult }
  getAvailableActions(state: GameState, playerId: string): AvailableActions
}
```

## 5. Infrastructure Layer

### 5.1 Ruleset Implementations

```
src/modules/mahjong/infrastructure/
├── rulesets/
│   ├── riichi/
│   │   ├── riichi.ruleset.ts       ← IRuleset implementation
│   │   ├── riichi-yaku.ts          ← ~30-40 yaku definitions
│   │   └── riichi-score.ts         ← Han/Fu → điểm lookup table
│   └── chinese/
│       ├── chinese.ruleset.ts      ← IRuleset implementation
│       ├── chinese-fan.ts          ← Top 20 fan definitions
│       └── chinese-score.ts        ← Fan tích lũy → điểm
└── repositories/
    ├── redis-game-state.repository.ts    ← Hot state (TTL 4h)
    └── prisma-game-result.repository.ts  ← Ghi khi ván kết thúc
```

### 5.2 Database Schema (bổ sung)
```prisma
model GameResult {
  id        String   @id @default(uuid())
  roomId    String   @map("room_id")
  ruleset   String
  winnerId  String?  @map("winner_id")
  players   Json     // [{userId, scoreChange, finalScore, hand}]
  endedAt   DateTime @default(now()) @map("ended_at")

  @@map("game_results")
}
```

### 5.3 Redis Key Design
```
game:state:{gameId}    → JSON serialized GameState   TTL: 4h
game:room:{roomId}     → gameId                       TTL: 4h
```

## 6. Application Layer — Use Cases

| Use Case | Trigger | Hành động |
|---|---|---|
| `StartGameUseCase` | Room đủ 4 người | Tạo GameState, chia bài, lưu Redis |
| `DrawTileUseCase` | Đến lượt player | Rút quân từ wall, tính available actions |
| `DiscardTileUseCase` | Player bỏ quân | Validate, cập nhật state, tính actions cho players khác |
| `ClaimTileUseCase` | Player ăn/cúp/riichi | Validate qua IRuleset, apply meld |
| `DeclareWinUseCase` | Player hú | Validate + tính điểm + ghi DB + cập nhật ELO |

## 7. Presentation Layer — WebSocket Events

### Client → Server:
```
game:draw                          ← rút bài
game:discard    { tileId }         ← bỏ bài
game:claim      { action, tiles }  ← ăn/cúp/riichi/kan
game:win                           ← tuyên bố hú
game:skip                          ← bỏ qua cơ hội ăn/cúp
```

### Server → Client:
```
game:state-update     → broadcast GameState (ẩn bài của player khác)
game:your-actions     → gửi riêng cho từng player (actions khả dụng)
game:win-result       → khi có người thắng (điểm, yaku/fan breakdown)
game:draw-result      → ván hòa (hết bài)
game:error            → invalid action
```

## 8. Data Flow
```
WebSocket Event (client)
      ↓
GameGateway (Presentation) — auth guard
      ↓
UseCase (Application) ← load GameState từ Redis
      ↓
GameEngine.method(state, ruleset) ← pure domain logic
      ↓
Lưu GameState mới vào Redis
      ↓
Broadcast state-update → tất cả clients trong room
      ↓ (nếu game kết thúc)
Ghi GameResult vào PostgreSQL
Cập nhật ELO của User
```

## 9. Testing Strategy
- **Unit test:** Mỗi yaku (Riichi) — test tất cả 30-40 yaku với hand cụ thể
- **Unit test:** Mỗi fan (Chinese) — test top 20 fan
- **Unit test:** `GameEngine` — test từng action (draw/discard/claim/win) với state fixture
- **Integration test:** Use case → Redis → PostgreSQL

## 10. Phần để lại sau MVP
- AI Bot module (độc lập, implement `IPlayer` interface, không ảnh hưởng GameEngine)
- Replay system
- Spectator mode
- Luật thứ 3 (thêm class implement IRuleset, không sửa code hiện tại)
