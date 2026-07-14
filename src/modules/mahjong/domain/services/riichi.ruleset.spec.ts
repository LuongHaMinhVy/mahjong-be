import { RiichiRuleset } from './riichi.ruleset.js';
import { Tile } from '../value-objects/tile.vo.js';

describe('RiichiRuleset - isTenpai', () => {
  let ruleset: RiichiRuleset;

  beforeEach(() => {
    ruleset = new RiichiRuleset();
  });

  it('should identify a Tenpai hand', () => {
    // Tanyao (All Simples) Tenpai hand:
    // Sets:
    // - Pin 2-3-4
    // - Pin 5-6-7
    // - Sou 2-3-4
    // - Man 2-2-2
    // - Pin 8 (Single waiting for Pin-8 to form pair)
    const tenpaiHand = [
      Tile.create('pin', 2, 'number', 'p2'),
      Tile.create('pin', 3, 'number', 'p3'),
      Tile.create('pin', 4, 'number', 'p4'),
      Tile.create('pin', 5, 'number', 'p5'),
      Tile.create('pin', 6, 'number', 'p6'),
      Tile.create('pin', 7, 'number', 'p7'),
      Tile.create('sou', 2, 'number', 's2'),
      Tile.create('sou', 3, 'number', 's3'),
      Tile.create('sou', 4, 'number', 's4'),
      Tile.create('man', 2, 'number', 'm2_1'),
      Tile.create('man', 2, 'number', 'm2_2'),
      Tile.create('man', 2, 'number', 'm2_3'),
      Tile.create('pin', 8, 'number', 'p8'),
    ];

    expect((ruleset as any).isTenpai(tenpaiHand)).toBe(true);
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
    expect((ruleset as any).isTenpai(randomHand)).toBe(false);
  });
});
