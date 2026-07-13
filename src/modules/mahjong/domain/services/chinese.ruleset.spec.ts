import { ChineseRuleset } from './chinese.ruleset.js';
import { Tile } from '../value-objects/tile.vo.js';

describe('ChineseRuleset', () => {
  let ruleset: ChineseRuleset;

  beforeEach(() => {
    ruleset = new ChineseRuleset();
  });

  it('should build 144 tiles including flowers and seasons', () => {
    const tiles = ruleset.buildTileSet();
    expect(tiles.length).toBe(144);

    const flowers = tiles.filter((t) => t.suit === 'flower');
    expect(flowers.length).toBe(8); // 4 flowers + 4 seasons
  });

  it('should validate a win with standard shape (even with 0 fan/Yaku)', () => {
    // Chinese classical allows winning on a simple hand without any specific Fan
    const hand = [
      Tile.create('man', 1, 'number', 't1'),
      Tile.create('man', 2, 'number', 't2'),
      Tile.create('man', 3, 'number', 't3'),

      Tile.create('pin', 4, 'number', 't4'),
      Tile.create('pin', 5, 'number', 't5'),
      Tile.create('pin', 6, 'number', 't6'),

      Tile.create('sou', 7, 'number', 't7'),
      Tile.create('sou', 8, 'number', 't8'),
      Tile.create('sou', 9, 'number', 't9'),

      Tile.create('honor', 1, 'wind', 't10'),
      Tile.create('honor', 1, 'wind', 't11'),
      Tile.create('honor', 1, 'wind', 't12'),

      Tile.create('honor', 2, 'wind', 't13'),
    ];

    const winningTile = Tile.create('honor', 2, 'wind', 'w1');

    const result = ruleset.canWin(hand, winningTile);
    expect(result?.isWin).toBe(true);
    expect(result?.fanCount).toBe(0); // 0 Fan win is allowed in Chinese Classical
  });

  it('should calculate points movement for Chinese scoring', () => {
    const winResult = {
      isWin: true,
      fanCount: 8, // 8 fan
      fanNames: ['Mixed Triplets'],
    };

    const context = {
      round: 0,
      honba: 0,
      dora: [],
      isWinnerDealer: false,
      isSelfDraw: true,
      riichiPlayers: [],
    };

    // p1 wins by self-draw (Tsumo).
    // In Chinese rules (simplified for MVP): every other player pays winner points based on Fan count.
    // e.g. 8 fan = 8 points or 8 * base multiplier. Let's design a simple point payout.
    const score = ruleset.calculateScore(
      winResult,
      'p1',
      ['p1', 'p2', 'p3', 'p4'],
      context,
    );

    expect(score.winnerId).toBe('p1');
    expect(score.points).toBe(24); // 8 fan * 3 players = 24 points
    expect(score.scoreMap['p1']).toBe(24);
    expect(score.scoreMap['p2']).toBe(-8);
  });
});
