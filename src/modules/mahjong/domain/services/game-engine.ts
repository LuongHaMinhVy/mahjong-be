import { GameState, type PlayerState } from '../entities/game-state.entity.js';
import { type Tile } from '../value-objects/tile.vo.js';
import { Meld, type MeldType } from '../value-objects/meld.vo.js';
import { type IRuleset } from './ruleset.interface.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export class GameEngine {
  constructor(private readonly ruleset: IRuleset) {}

  /**
   * Initializes a new Mahjong game state.
   */
  initializeGame(roomId: string, playerIds: string[]): GameState {
    if (playerIds.length !== 4) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Mahjong requires exactly 4 players.',
      );
    }

    // 1. Build and shuffle tiles
    const fullSet = this.ruleset.buildTileSet();
    const wall = this.shuffle(fullSet);

    // 2. Deal hands
    const players: PlayerState[] = playerIds.map((userId) => ({
      userId,
      hand: [],
      melds: [],
      discards: [],
      score: this.ruleset.name === 'riichi' ? 25000 : 10000,
      isRiichi: false,
    }));

    const handSize = this.ruleset.initialHandSize;
    for (let i = 0; i < handSize; i++) {
      for (const player of players) {
        const tile = wall.pop();
        if (tile) {
          player.hand.push(tile);
        }
      }
    }

    // Sort initial hands (optional, but good practice)
    for (const player of players) {
      this.sortHand(player.hand);
    }

    // Generate unique game ID (can be uuid or simple timestamp-random combination)
    const gameId = `game-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    return new GameState(
      gameId,
      roomId,
      this.ruleset.name,
      'playing',
      wall,
      0,
      players,
    );
  }

  /**
   * Draws a tile from the wall for the current turn player.
   */
  drawTile(state: GameState): Tile {
    if (state.phase !== 'playing') {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Game is not in playing phase.',
      );
    }

    if (state.wall.length === 0) {
      state.phase = 'finished'; // Exhaustive draw
      throw new DomainException(
        'VALIDATION_ERROR',
        'No tiles left in the wall.',
      );
    }

    const tile = state.wall.pop()!;
    const activePlayer = state.getCurrentPlayer();
    activePlayer.hand.push(tile);

    return tile;
  }

  /**
   * Discards a tile for a player.
   */
  discardTile(state: GameState, playerId: string, tileId: string): void {
    if (state.phase !== 'playing') {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Game is not in playing phase.',
      );
    }

    const activePlayer = state.getCurrentPlayer();
    if (activePlayer.userId !== playerId) {
      throw new DomainException(
        'VALIDATION_ERROR',
        "It is not this player's turn.",
      );
    }

    const tileIndex = activePlayer.hand.findIndex((t) => t.id === tileId);
    if (tileIndex === -1) {
      throw new DomainException('NOT_FOUND', 'Tile not found in hand.');
    }

    const [discardedTile] = activePlayer.hand.splice(tileIndex, 1);
    activePlayer.discards.push(discardedTile);
    state.discardPile[state.currentTurn].push(discardedTile);

    this.sortHand(activePlayer.hand);

    // Advanced turn
    state.nextTurn();
  }

  /**
   * Claims a meld (Chi, Pon, Kan).
   */
  claimMeld(
    state: GameState,
    claimingPlayerId: string,
    meldType: MeldType,
    claimedTile: Tile,
    handTilesToUse: Tile[],
  ): void {
    const claimer = state.players.find((p) => p.userId === claimingPlayerId);
    if (!claimer) {
      throw new DomainException('NOT_FOUND', 'Claiming player not found.');
    }

    // Verify hand has the tiles used for meld
    for (const t of handTilesToUse) {
      const exists = claimer.hand.some((ht) => ht.equals(t));
      if (!exists) {
        throw new DomainException(
          'NOT_FOUND',
          `Tile ${t.suit}-${t.value} not found in player hand.`,
        );
      }
    }

    // Remove tiles from hand
    for (const t of handTilesToUse) {
      const idx = claimer.hand.findIndex((ht) => ht.id === t.id);
      if (idx !== -1) {
        claimer.hand.splice(idx, 1);
      }
    }

    // Create the meld
    const meldTiles = [...handTilesToUse, claimedTile];
    const meld = new Meld(meldType, meldTiles, false);
    claimer.melds.push(meld);

    // Update current turn to the claimer
    const claimerIdx = state.players.findIndex(
      (p) => p.userId === claimingPlayerId,
    );
    state.currentTurn = claimerIdx;

    // Sort hand
    this.sortHand(claimer.hand);
  }

  private shuffle(tiles: Tile[]): Tile[] {
    const arr = [...tiles];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private sortHand(hand: Tile[]): void {
    const suitOrder = { man: 1, pin: 2, sou: 3, honor: 4, flower: 5 };
    hand.sort((a, b) => {
      if (a.suit !== b.suit) {
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return a.value - b.value;
    });
  }
}
