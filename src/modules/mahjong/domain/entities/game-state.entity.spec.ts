import { GameState } from './game-state.entity.js';
import { Tile } from '../value-objects/tile.vo.js';

describe('GameState Replay Actions', () => {
  it('should add actions to game state correctly', () => {
    const state = new GameState('g1', 'r1', 'riichi', 'playing', [], 0, []);
    expect(state.actions).toBeDefined();
    expect(state.actions.length).toBe(0);

    const tile = Tile.create('man', 1, 'number', 't1');
    state.addAction('u1', 'discard', tile);

    expect(state.actions.length).toBe(1);
    expect(state.actions[0].type).toBe('discard');
    expect(state.actions[0].playerId).toBe('u1');
    expect(state.actions[0].tile?.id).toBe('t1');
  });
});
