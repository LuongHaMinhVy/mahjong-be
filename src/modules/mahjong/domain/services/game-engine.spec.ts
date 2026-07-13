import { GameEngine } from './game-engine.js';
import {
  IRuleset,
  type ScoreResult,
  type WinResult,
} from './ruleset.interface.js';
import { Tile } from '../value-objects/tile.vo.js';

class MockRuleset extends IRuleset {
  readonly name = 'riichi';
  readonly initialHandSize = 13;

  buildTileSet(): Tile[] {
    const tiles: Tile[] = [];
    const suits: ('man' | 'pin' | 'sou')[] = ['man', 'pin', 'sou'];
    for (const suit of suits) {
      for (let i = 1; i <= 9; i++) {
        for (let j = 0; j < 4; j++) {
          tiles.push(Tile.create(suit, i, 'number', `${suit}-${i}-${j}`));
        }
      }
    }
    return tiles;
  }

  canChi(): boolean {
    return false;
  }

  canPon(): boolean {
    return false;
  }

  canKan(): boolean {
    return false;
  }

  canWin(): WinResult {
    return { isWin: false };
  }

  calculateScore(
    win: WinResult,
    winnerId: string,
    playerIds: string[],
  ): ScoreResult {
    const scoreMap: Record<string, number> = {};
    for (const pid of playerIds) {
      scoreMap[pid] = pid === winnerId ? 3000 : -1000;
    }
    return { winnerId, points: 3000, scoreMap };
  }
}

describe('GameEngine Domain Service', () => {
  let engine: GameEngine;
  let ruleset: IRuleset;

  beforeEach(() => {
    ruleset = new MockRuleset();
    engine = new GameEngine(ruleset);
  });

  it('should initialize a new game with dealing hands', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4'];
    const state = engine.initializeGame('room-1', playerIds);

    expect(state.roomId).toBe('room-1');
    expect(state.phase).toBe('playing');
    expect(state.players.length).toBe(4);
    expect(state.players[0].hand.length).toBe(13);
    expect(state.players[0].score).toBe(25000);
    // Wall should be depleted by 13 * 4 = 52 tiles
    expect(state.wall.length).toBe(ruleset.buildTileSet().length - 52);
  });

  it('should allow active player to draw a tile', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4'];
    const state = engine.initializeGame('room-1', playerIds);

    const initialHandSize = state.players[0].hand.length;
    const initialWallSize = state.wall.length;

    engine.drawTile(state);

    expect(state.players[0].hand.length).toBe(initialHandSize + 1);
    expect(state.wall.length).toBe(initialWallSize - 1);
  });

  it('should allow player to discard a tile', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4'];
    const state = engine.initializeGame('room-1', playerIds);
    engine.drawTile(state); // p1 has 14 tiles now

    const tileToDiscard = state.players[0].hand[0];
    engine.discardTile(state, 'p1', tileToDiscard.id);

    expect(state.players[0].hand.length).toBe(13);
    expect(state.players[0].discards.length).toBe(1);
    expect(state.players[0].discards[0].id).toBe(tileToDiscard.id);
    expect(state.currentTurn).toBe(1); // turn advanced to player 2
  });
});
