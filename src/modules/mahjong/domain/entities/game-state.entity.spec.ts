import { GameState, type PlayerState } from './game-state.entity.js';
import { Tile } from '../value-objects/tile.vo.js';

describe('GameState Entity', () => {
  it('should initialize a game state with players and verify fields', () => {
    const players: PlayerState[] = [
      {
        userId: 'u1',
        hand: [],
        melds: [],
        discards: [],
        score: 25000,
        isRiichi: false,
      },
      {
        userId: 'u2',
        hand: [],
        melds: [],
        discards: [],
        score: 25000,
        isRiichi: false,
      },
      {
        userId: 'u3',
        hand: [],
        melds: [],
        discards: [],
        score: 25000,
        isRiichi: false,
      },
      {
        userId: 'u4',
        hand: [],
        melds: [],
        discards: [],
        score: 25000,
        isRiichi: false,
      },
    ];

    const wall = [Tile.create('man', 1, 'number', '1')];

    const game = new GameState(
      'g1',
      'r1',
      'riichi',
      'playing',
      wall,
      0,
      players,
    );

    expect(game.id).toBe('g1');
    expect(game.roomId).toBe('r1');
    expect(game.rulesetName).toBe('riichi');
    expect(game.phase).toBe('playing');
    expect(game.wall.length).toBe(1);
    expect(game.currentTurn).toBe(0);
    expect(game.players.length).toBe(4);
    expect(game.players[0].userId).toBe('u1');
    expect(game.players[0].score).toBe(25000);
  });
});
