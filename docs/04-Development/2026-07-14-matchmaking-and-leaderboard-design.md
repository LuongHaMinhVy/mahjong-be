# Design Document: Matchmaking & Leaderboard Modules

## 1. Overview
This document outlines the architecture and implementation details for the **Matchmaking** and **Leaderboard** modules. These modules complete the matchmaking flow (using a real-time Dynamic ELO expansion queue with a 10-second accept/decline confirmation step) and the ranking system (providing a paginated global leaderboard with a pinned "My Rank" card for the authenticated user).

Both modules adhere to NestJS Clean Architecture guidelines, ensuring domain isolation and layer separation.

---

## 2. Redis Data Structures (Matchmaking)
To support distributed matchmaking and coordinate state across multiple server instances, matchmaking queue states are maintained in Redis:

### Matchmaking Queue Sorted Set
* **Key**: `matchmaking:queue:<ruleset>` (where `<ruleset>` is `riichi` or `chinese`)
* **Score**: Player's ELO rating (`elo`, integer)
* **Member**: `userId` (string)

### Join Timestamps Hash
* **Key**: `matchmaking:joined-at:<ruleset>`
* **Field**: `userId` (string)
* **Value**: UNIX timestamp (milliseconds, string representation) of when the player entered the queue.

### Pending Match Ticket Hash
* **Key**: `matchmaking:ticket:<ticketId>`
* **TTL**: 10 seconds (managed via Redis expire or checked programmatically)
* **Fields**:
  * `id`: Unique ticket ID (`uuid`)
  * `ruleset`: `'riichi' | 'chinese'`
  * `players`: Comma-separated list of 4 `userId`s (e.g., `user1,user2,user3,user4`)
  * `accepted`: Comma-separated list of `userId`s who have accepted the match so far.
  * `createdAt`: Description of when the ticket was created.

---

## 3. Domain Layer

### Matchmaking Models
We define domain-level concepts for matchmaking:

#### MatchmakingQueueEntry
```typescript
export class MatchmakingQueueEntry {
  constructor(
    public readonly userId: string,
    public readonly elo: number,
    public readonly joinedAt: Date,
  ) {}

  getAllowedEloGap(currentTime: Date): number {
    const elapsedSeconds = Math.max(0, Math.floor((currentTime.getTime() - this.joinedAt.getTime()) / 1000));
    // ELO gap increases by 5 ELO per second in queue, starting at a base of 100
    return 100 + elapsedSeconds * 5;
  }
}
```

#### MatchTicket
```typescript
export class MatchTicket {
  constructor(
    public readonly id: string,
    public readonly ruleset: 'riichi' | 'chinese',
    public readonly players: string[], // user IDs
    public readonly acceptedPlayers: string[], // user IDs
    public readonly createdAt: Date,
  ) {}

  isFullyAccepted(): boolean {
    return this.players.length === this.acceptedPlayers.length &&
      this.players.every(p => this.acceptedPlayers.includes(p));
  }
}
```

### Matchmaking Repository Port
```typescript
export abstract class IMatchmakingRepository {
  abstract addToQueue(ruleset: 'riichi' | 'chinese', userId: string, elo: number, joinedAt: Date): Promise<void>;
  abstract removeFromQueue(ruleset: 'riichi' | 'chinese', userId: string): Promise<void>;
  abstract getQueue(ruleset: 'riichi' | 'chinese'): Promise<MatchmakingQueueEntry[]>;
  
  abstract createTicket(ticket: MatchTicket): Promise<void>;
  abstract getTicket(ticketId: string): Promise<MatchTicket | null>;
  abstract saveTicket(ticket: MatchTicket): Promise<void>;
  abstract deleteTicket(ticketId: string): Promise<void>;
}
```

---

## 4. Application Layer

### Use Cases (Matchmaking)

#### 1. JoinQueueUseCase
Adds a user to the matchmaking queue for a specific ruleset.
* **Input**: `{ userId: string, ruleset: 'riichi' | 'chinese' }`
* **Output**: `void`

#### 2. LeaveQueueUseCase
Removes a user from the matchmaking queue.
* **Input**: `{ userId: string, ruleset: 'riichi' | 'chinese' }`
* **Output**: `void`

#### 3. MatchmakingProcessor (Cron / Loop)
A background processor executing every 2 seconds to match players in the queues.
* **Algorithm**:
  1. For each ruleset queue, fetch all entries ordered by ELO.
  2. If the queue has fewer than 4 players, skip.
  3. Sort players by `joinedAt` (ascending) to prioritize those waiting longest.
  4. Iterate through players to find a group of 4 where all players are mutually within each other's ELO tolerance:
     * Tolerance for Player A: `[eloA - gapA, eloA + gapA]` where `gapA = 100 + waitTimeA * 5`.
     * Check if ELO of Player B, C, and D falls within the tolerances of each other.
  5. Once a group is found:
     * Remove all 4 players from the queue.
     * Create a new `MatchTicket` with a TTL of 10 seconds.
     * Broadcast `matchmaking:found` via WebSockets to all 4 players with `ticketId`.

#### 4. RespondToMatchUseCase
Processes a player's accept or decline decision.
* **Input**: `{ userId: string, ticketId: string, accept: boolean }`
* **Output**: `{ status: 'accepted' | 'declined' | 'completed' | 'cancelled', ticket?: MatchTicket }`
* **Flow**:
  * If **Decline**:
    * Delete the ticket.
    * Broadcast `matchmaking:cancelled` to all 4 players.
    * Requeue the other 3 players at the front of the queue (their original join timestamp is preserved).
  * If **Accept**:
    * Add `userId` to `acceptedPlayers` on the ticket.
    * If `isFullyAccepted()` is `true`:
      * Delete the ticket.
      * Invoke `CreateRoomUseCase` with a default name (e.g., `Matchmaking Room`) using the first player as host.
      * Invoke `JoinRoomUseCase` for the remaining 3 players.
      * Automatically set all 4 players to `ready` status.
      * Start the match using `StartGameUseCase`.
      * Broadcast `matchmaking:success` to the 4 players containing the `roomId`.
    * Otherwise:
      * Save the updated ticket.
      * Broadcast `matchmaking:status` to the 4 players containing updated acceptance counts (e.g., `2/4 accepted`).

---

### Use Cases (Leaderboard)

#### 1. GetLeaderboardUseCase
Fetches the global leaderboard with user stats and pins the current user's rank.
* **Input**: `{ userId: string, page: number, limit: number }`
* **Output**:
  ```typescript
  interface LeaderboardResponse {
    data: Array<{
      rank: number;
      userId: string;
      displayName: string;
      avatar: string | null;
      elo: number;
      stats: {
        totalGames: number;
        wins: number;
        winRate: number;
      };
    }>;
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    currentUserRank: {
      rank: number;
      userId: string;
      displayName: string;
      avatar: string | null;
      elo: number;
      stats: {
        totalGames: number;
        wins: number;
        winRate: number;
      };
    } | null;
  }
  ```
* **Algorithm**:
  1. Retrieve paginated list of users from PostgreSQL sorted by `elo DESC`.
  2. Compute ranks based on offset (e.g., `rank = offset + index + 1`).
  3. Fetch statistics (`totalGames`, `wins`, `winRate`) for each user in the page by counting matches in `GameResult` table.
  4. Query the caller's ELO and count how many users have a higher ELO to determine their exact rank:
     `rank = prisma.user.count({ where: { elo: { gt: currentUser.elo } } }) + 1`.
  5. Compute statistics for the caller to populate the `currentUserRank` card.

---

## 5. Presentation Layer & WebSocket Events

### Matchmaking WebSocket Gateway Events
| Event Name | Direction | Payload | Behavior |
| :--- | :--- | :--- | :--- |
| **`matchmaking:join`** | Client -> Server | `{ ruleset: 'riichi' \| 'chinese' }` | Enters matchmaking queue |
| **`matchmaking:leave`** | Client -> Server | `{ ruleset: 'riichi' \| 'chinese' }` | Exits matchmaking queue |
| **`matchmaking:found`** | Server -> Client | `{ ticketId: string, timeout: number }` | Sent when 4 players are matched |
| **`matchmaking:respond`** | Client -> Server | `{ ticketId: string, accept: boolean }` | User accepts or declines the match |
| **`matchmaking:status`** | Server -> Client | `{ acceptedCount: number, totalCount: 4 }` | Broadcasts current acceptance status |
| **`matchmaking:success`** | Server -> Client | `{ roomId: string }` | Sent when all accept, redirects client to room |
| **`matchmaking:cancelled`** | Server -> Client | `{ reason: string }` | Sent if match expires or someone declines |
| **`matchmaking:requeued`** | Server -> Client | None | Sent to accepting players when they are requeued |

### Leaderboard HTTP Controller
* **Route**: `GET /leaderboard`
* **Query Parameters**:
  * `page` (optional, default: `1`)
  * `limit` (optional, default: `20`, max: `100`)
* **Guard**: `@UseGuards(JwtAuthGuard)` (requires authentication to calculate user's relative ranking)
