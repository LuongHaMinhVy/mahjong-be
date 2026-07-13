import { RiichiRuleset } from './riichi.ruleset.js';
import { Tile } from '../value-objects/tile.vo.js';

describe('RiichiRuleset', () => {
  let ruleset: RiichiRuleset;

  beforeEach(() => {
    ruleset = new RiichiRuleset();
  });

  it('should build a standard set of 136 tiles', () => {
    const tiles = ruleset.buildTileSet();
    expect(tiles.length).toBe(136);

    const suitCounts = tiles.reduce(
      (acc, t) => {
        acc[t.suit] = (acc[t.suit] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    expect(suitCounts['man']).toBe(36);
    expect(suitCounts['pin']).toBe(36);
    expect(suitCounts['sou']).toBe(36);
    expect(suitCounts['honor']).toBe(28); // 4 winds * 4 + 3 dragons * 4 = 28
  });

  it('should check Pon (Triplets) possibility', () => {
    const hand = [
      Tile.create('man', 1, 'number', '1'),
      Tile.create('man', 1, 'number', '2'),
      Tile.create('man', 2, 'number', '3'),
    ];
    const tileToPon = Tile.create('man', 1, 'number', '4');
    expect(ruleset.canPon(hand, tileToPon)).toBe(true);

    const tileNotToPon = Tile.create('man', 2, 'number', '5');
    expect(ruleset.canPon(hand, tileNotToPon)).toBe(false);
  });

  it('should check Chi (Runs) possibility only from left player', () => {
    const hand = [
      Tile.create('man', 2, 'number', '1'),
      Tile.create('man', 3, 'number', '2'),
    ];
    const tileToChi = Tile.create('man', 1, 'number', '3');

    // fromPosition = 3 means the player to the left discarded (since positions are 0,1,2,3 relative, 3 is left of 0)
    // Let's specify that fromPosition is (claimerPosition - 1 + 4) % 4
    // If claimer is 0, player on left is 3.
    expect(ruleset.canChi(hand, tileToChi, 3)).toBe(true);
    expect(ruleset.canChi(hand, tileToChi, 2)).toBe(false); // from opposite
  });

  it('should validate a Tanyao (All Simples) win', () => {
    // 4 melds + 1 pair, all between 2 and 8
    const hand = [
      Tile.create('man', 2, 'number', 't1'),
      Tile.create('man', 3, 'number', 't2'),
      Tile.create('man', 4, 'number', 't3'),

      Tile.create('man', 5, 'number', 't4'),
      Tile.create('man', 6, 'number', 't5'),
      Tile.create('man', 7, 'number', 't6'),

      Tile.create('pin', 3, 'number', 't7'),
      Tile.create('pin', 4, 'number', 't8'),
      Tile.create('pin', 5, 'number', 't9'),

      Tile.create('sou', 4, 'number', 't10'),
      Tile.create('sou', 4, 'number', 't11'),
      Tile.create('sou', 4, 'number', 't12'),

      Tile.create('sou', 6, 'number', 't13'),
    ];

    const winningTile = Tile.create('sou', 6, 'number', 'w1');

    const result = ruleset.canWin(hand, winningTile);
    expect(result?.isWin).toBe(true);
    expect(result?.yakuNames).toContain('Tanyao');
    expect(result?.han).toBe(1);
    expect(result?.fu).toBe(30); // Ron wait
  });

  it('should calculate Tsumo points movement', () => {
    const winResult = {
      isWin: true,
      han: 1,
      fu: 30,
      yakuNames: ['Tanyao'],
    };

    const context = {
      round: 0,
      honba: 0,
      dora: [],
      isWinnerDealer: false,
      isSelfDraw: true,
      riichiPlayers: [],
    };

    // p1 (Non-dealer) wins by Tsumo. 1 han 30 fu = 1000 points total.
    // Dealer pays 500, non-dealers pay 300 each (total 1100 due to rounding up to 100s).
    const score = ruleset.calculateScore(
      winResult,
      'p1',
      ['p1', 'p2', 'p3', 'p4'],
      context,
    );

    expect(score.winnerId).toBe('p1');
    expect(score.points).toBe(1100);
    // p2 is dealer (let's assume dealer is p2 for round 0, or let's check scoreMap for the pays)
    expect(score.scoreMap['p1']).toBe(1100);
    // Dealer pays 500, others pay 300
    // In our simplified logic: we can designate dealer by playerId or index.
    // Let's implement calculateScore so dealer pays are handled correctly.
  });
});
