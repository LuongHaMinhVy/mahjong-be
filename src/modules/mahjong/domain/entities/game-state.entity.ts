import { type Tile } from '../value-objects/tile.vo.js';
import { type Meld } from '../value-objects/meld.vo.js';
import {
  type GameAction,
  type GameActionType,
} from '../value-objects/game-action.vo.js';

export interface PlayerState {
  userId: string;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  score: number;
  isRiichi: boolean;
}

export class GameState {
  public actions: GameAction[] = [];

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

  getCurrentPlayer(): PlayerState {
    return this.players[this.currentTurn];
  }

  nextTurn(): void {
    this.currentTurn = (this.currentTurn + 1) % 4;
  }

  addAction(
    playerId: string,
    type: GameActionType,
    tile?: Tile,
    extra?: any,
  ): void {
    this.actions.push({
      sequence: this.actions.length,
      playerId,
      type,
      tile: tile
        ? { suit: tile.suit, value: tile.value, type: tile.type, id: tile.id }
        : undefined,
      extra,
      timestamp: Date.now(),
    });
  }
}
