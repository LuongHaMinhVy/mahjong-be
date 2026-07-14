# Design Document: Lobby & Room Modules (Real-time Match Coordination)

## 1. Overview
The Lobby & Room Modules are responsible for managing players before a Mahjong game starts. They allow users to see active game rooms, view online players, create new rooms, join existing rooms, toggle their ready status, and allow room hosts to start a new match.

State management is powered by **Redis** to support high-performance real-time updates and horizontal scalability. Standard database changes are limited to introducing the `role` field on the `User` model in PostgreSQL to support admin authorization.

---

## 2. PostgreSQL Schema Update
To support admin capability within a feature-based architecture (e.g. allowing `/users/admin/...` paths in the future), the PostgreSQL `User` model is updated with a `role` field.

```prisma
model User {
  id              String         @id @default(uuid())
  email           String         @unique
  passwordHash    String         @map("password_hash")
  displayName     String         @map("display_name")
  avatar          String?
  elo             Int            @default(1000)
  role            String         @default("USER") // Added: "USER" or "ADMIN"
  isEmailVerified Boolean        @default(false) @map("is_email_verified")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")
  refreshTokens   RefreshToken[]
  gameResults     GameResult[]   @relation("WinnerRelation")

  @@map("users")
}
```

---

## 3. Redis Data Structures
All transient real-time states are stored in Redis:

### Online Users Hash
* **Key**: `online_players`
* **Field**: `userId` (string)
* **Value** (JSON string):
  ```json
  {
    "userId": "uuid-string",
    "socketId": "socket-id",
    "displayName": "PlayerName",
    "avatar": "avatar-url",
    "elo": 1000,
    "status": "idle" | "in_room" | "playing",
    "currentRoomId": "room-uuid" | null
  }
  ```

### Active Rooms Hash
* **Key**: `lobby:rooms`
* **Field**: `roomId` (string)
* **Value** (JSON string):
  ```json
  {
    "id": "room-uuid",
    "name": "Room Name",
    "hostId": "host-user-uuid",
    "status": "waiting" | "playing",
    "ruleset": "riichi" | "chinese",
    "players": [
      {
        "userId": "user-uuid",
        "displayName": "PlayerName",
        "avatar": "avatar-url",
        "elo": 1000,
        "isReady": boolean
      }
    ]
  }
  ```

---

## 4. Domain Layer

### Room Entity
Represents a game room. Encapsulates room state changes and invariants.

```typescript
export class RoomPlayer {
  constructor(
    public readonly userId: string,
    public readonly displayName: string,
    public readonly avatar: string | null,
    public readonly elo: number,
    public isReady: boolean,
  ) {}
}

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

    // If host leaves, assign a new host if room not empty
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
    // All players except the host must be ready
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

### RoomRepository (Port)
```typescript
export abstract class IRoomRepository {
  abstract save(room: Room): Promise<void>;
  abstract findById(id: string): Promise<Room | null>;
  abstract delete(id: string): Promise<void>;
  abstract findAllWaiting(): Promise<Room[]>;
}
```

---

## 5. Application Layer

### Use Cases

#### 1. CreateRoomUseCase
Creates a room and sets the host as the first player.
* **Input**: `{ hostId: string, name: string, ruleset: 'riichi' | 'chinese' }`
* **Output**: `Room`

#### 2. JoinRoomUseCase
Allows a player to join a room.
* **Input**: `{ userId: string, roomId: string }`
* **Output**: `Room`

#### 3. LeaveRoomUseCase
Allows a player to leave a room.
* **Input**: `{ userId: string, roomId: string }`
* **Output**: `{ roomId: string, closed: boolean, newHostId?: string }`

#### 4. ToggleReadyUseCase
Allows a player to toggle ready status.
* **Input**: `{ userId: string, roomId: string, isReady: boolean }`
* **Output**: `Room`

#### 5. StartGameUseCase
Transitions room to playing status.
* **Input**: `{ hostId: string, roomId: string }`
* **Output**: `Room`

---

## 6. Presentation Layer & WebSocket Events

A unified or namespace-based WebSocket Gateway (`lobby` and `room` groups) handles connections and actions.

### Events Map
| Event Name | Role | Payload | Response / Broadcast |
| :--- | :--- | :--- | :--- |
| **`lobby:get_rooms`** | Client -> Server | None | `room_list` returned to client |
| **`room:create`** | Client -> Server | `{ name, ruleset }` | Joins room, broadcasts `lobby:updated` to Lobby |
| **`room:join`** | Client -> Server | `{ roomId }` | Joins room, broadcasts `room:player_joined` to Room, updates Lobby |
| **`room:leave`** | Client -> Server | `{ roomId }` | Leaves room, broadcasts `room:player_left` to Room, updates Lobby |
| **`room:ready`** | Client -> Server | `{ isReady }` | Broadcasts `room:ready_changed` to Room |
| **`room:start`** | Client -> Server | `{ roomId }` | Broadcasts `room:game_started` to Room, updates Lobby |
