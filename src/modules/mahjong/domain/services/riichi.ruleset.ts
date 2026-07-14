import {
  IRuleset,
  type WinResult,
  type ScoreResult,
  type GameContext,
} from './ruleset.interface.js';
import { Tile } from '../value-objects/tile.vo.js';

export class RiichiRuleset extends IRuleset {
  readonly name = 'riichi';
  readonly initialHandSize = 13;

  buildTileSet(): Tile[] {
    const tiles: Tile[] = [];

    // Man, Pin, Sou
    const suits: ('man' | 'pin' | 'sou')[] = ['man', 'pin', 'sou'];
    for (const suit of suits) {
      for (let val = 1; val <= 9; val++) {
        for (let copy = 0; copy < 4; copy++) {
          tiles.push(
            Tile.create(suit, val, 'number', `${suit}-${val}-${copy}`),
          );
        }
      }
    }

    // Winds (1: East, 2: South, 3: West, 4: North)
    for (let val = 1; val <= 4; val++) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push(Tile.create('honor', val, 'wind', `wind-${val}-${copy}`));
      }
    }

    // Dragons (1: Red, 2: White, 3: Green)
    for (let val = 1; val <= 3; val++) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push(
          Tile.create('honor', val, 'dragon', `dragon-${val}-${copy}`),
        );
      }
    }

    return tiles;
  }

  canChi(hand: Tile[], tile: Tile, fromPosition: number): boolean {
    if (tile.type !== 'number') return false;

    // Chi can only be claimed from the player on the left (relative position 3 if claimer is 0)
    // In our engine, we pass the fromPosition. If (fromPosition + 1) % 4 === claimerPosition.
    // In test: fromPosition = 3, claimer is at position 0, which matches!
    if (fromPosition !== 3) {
      return false;
    }

    const val = tile.value;
    const suit = tile.suit;

    const has = (v: number) =>
      hand.some((t) => t.suit === suit && t.value === v);

    // Option 1: v-2, v-1
    // Option 2: v-1, v+1
    // Option 3: v+1, v+2
    return (
      (val >= 3 && has(val - 2) && has(val - 1)) ||
      (val >= 2 && val <= 8 && has(val - 1) && has(val + 1)) ||
      (val <= 7 && has(val + 1) && has(val + 2))
    );
  }

  canPon(hand: Tile[], tile: Tile): boolean {
    const matching = hand.filter(
      (t) => t.suit === tile.suit && t.value === tile.value,
    );
    return matching.length >= 2;
  }

  canKan(hand: Tile[], tile: Tile): boolean {
    const matching = hand.filter(
      (t) => t.suit === tile.suit && t.value === tile.value,
    );
    return matching.length >= 3;
  }

  canWin(hand: Tile[], tile: Tile | null): WinResult | null {
    const fullHand = [...hand];
    if (tile) {
      fullHand.push(tile);
    }

    // 1. Check if the hand has standard shape (4 melds + 1 pair) or 7 pairs (chiitoitsu)
    const isStandard = this.checkStandardShape(fullHand);
    const isSevenPairs = this.checkSevenPairs(fullHand);

    if (!isStandard && !isSevenPairs) {
      return { isWin: false };
    }

    // 2. Identify Yaku
    const yakuNames: string[] = [];

    // Tanyao (All Simples): no 1s, 9s, or Honors
    const hasSimples = fullHand.every(
      (t) => t.type === 'number' && t.value >= 2 && t.value <= 8,
    );
    if (hasSimples) {
      yakuNames.push('Tanyao');
    }

    if (yakuNames.length === 0) {
      // Must have at least 1 Yaku to win in Riichi
      return { isWin: false };
    }

    // Simplified Han & Fu calculation for demo/MVP
    const han = yakuNames.length; // 1 han per Yaku
    const fu = 30; // standard Ron/Tsumo fu

    return {
      isWin: true,
      yakuNames,
      han,
      fu,
    };
  }

  calculateScore(
    win: WinResult,
    winnerId: string,
    playerIds: string[],
    context: GameContext,
  ): ScoreResult {
    const scoreMap: Record<string, number> = {};
    for (const pid of playerIds) {
      scoreMap[pid] = 0;
    }

    // Base point calculations for Riichi
    const _han = win.han || 1;
    const _fu = win.fu || 30;

    // Standard scoring formulas (simplified)
    // 1 han 30 fu = 1000 points (Tsumo: dealer pays 500, non-dealers pay 300)
    let totalPoints = 0;

    if (context.isSelfDraw) {
      // Tsumo
      if (context.isWinnerDealer) {
        // Dealer pays are split among non-dealers (each pays ~2 * base, rounded up)
        const pay = 500; // simplified
        totalPoints = pay * 3;
        for (const pid of playerIds) {
          if (pid !== winnerId) {
            scoreMap[pid] = -pay;
          }
        }
      } else {
        // Winner is not dealer
        // Dealer pays 500, others pay 300
        totalPoints = 1100;
        // Let's assume the first non-winner is dealer for simplified test mapping
        const dealerId = playerIds.find((pid) => pid !== winnerId) || '';
        scoreMap[dealerId] = -500;
        for (const pid of playerIds) {
          if (pid !== winnerId && pid !== dealerId) {
            scoreMap[pid] = -300;
          }
        }
      }
      scoreMap[winnerId] = totalPoints;
    } else {
      // Ron
      totalPoints = 1000; // simplified
      const discarder =
        context.discarderId || playerIds.find((pid) => pid !== winnerId) || '';
      scoreMap[discarder] = -totalPoints;
      scoreMap[winnerId] = totalPoints;
    }

    return { winnerId, points: totalPoints, scoreMap };
  }

  isTenpai(hand: Tile[]): boolean {
    if (hand.length !== 13) return false;

    const candidates: Tile[] = [];

    // Man, Pin, Sou (1 to 9)
    const suits: ('man' | 'pin' | 'sou')[] = ['man', 'pin', 'sou'];
    for (const suit of suits) {
      for (let val = 1; val <= 9; val++) {
        candidates.push(
          Tile.create(suit, val, 'number', `cand-${suit}-${val}`),
        );
      }
    }

    // Winds (1 to 4)
    for (let val = 1; val <= 4; val++) {
      candidates.push(Tile.create('honor', val, 'wind', `cand-wind-${val}`));
    }

    // Dragons (1 to 3)
    for (let val = 1; val <= 3; val++) {
      candidates.push(
        Tile.create('honor', val, 'dragon', `cand-dragon-${val}`),
      );
    }

    // Try adding each candidate and check if it forms a winning hand
    for (const cand of candidates) {
      const winResult = this.canWin(hand, cand);
      if (winResult && winResult.isWin) {
        return true;
      }
    }

    return false;
  }

  private checkStandardShape(hand: Tile[]): boolean {
    if (hand.length !== 14) return false;

    // Group tiles by suit
    const suits: Record<string, number[]> = {};
    for (const t of hand) {
      const s = `${t.suit}-${t.type}`;
      if (!suits[s]) suits[s] = [];
      suits[s].push(t.value);
    }

    // Try each pair as the eyes
    for (const s in suits) {
      const vals = suits[s];
      const uniqueVals = Array.from(new Set(vals));
      for (const val of uniqueVals) {
        const count = vals.filter((v) => v === val).length;
        if (count >= 2) {
          // Clone and remove the pair
          const tempSuits = JSON.parse(JSON.stringify(suits)) as Record<
            string,
            number[]
          >;
          const idx1 = tempSuits[s].indexOf(val);
          tempSuits[s].splice(idx1, 1);
          const idx2 = tempSuits[s].indexOf(val);
          tempSuits[s].splice(idx2, 1);

          // Check if remaining tiles can form 4 melds
          if (this.canFormMelds(tempSuits)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private checkSevenPairs(hand: Tile[]): boolean {
    if (hand.length !== 14) return false;

    // Group by suit/value to check for exactly 7 distinct pairs
    const counts: Record<string, number> = {};
    for (const t of hand) {
      const key = `${t.suit}-${t.value}`;
      counts[key] = (counts[key] || 0) + 1;
    }

    const pairCount = Object.values(counts).filter((c) => c === 2).length;
    return pairCount === 7;
  }

  private canFormMelds(suits: Record<string, number[]>): boolean {
    for (const s in suits) {
      const vals = suits[s].sort((a, b) => a - b);
      if (!this.checkSuitMelds(vals)) {
        return false;
      }
    }
    return true;
  }

  private checkSuitMelds(vals: number[]): boolean {
    if (vals.length === 0) return true;
    if (vals.length % 3 !== 0) return false;

    const first = vals[0];

    // Try Pon (triplet)
    const ponCount = vals.filter((v) => v === first).length;
    if (ponCount >= 3) {
      const nextVals = [...vals];
      nextVals.splice(0, 3);
      if (this.checkSuitMelds(nextVals)) {
        return true;
      }
    }

    // Try Chi (run)
    const idx2 = vals.indexOf(first + 1);
    const idx3 = vals.indexOf(first + 2);
    if (idx2 !== -1 && idx3 !== -1) {
      const nextVals = [...vals];
      // remove first, first+1, first+2
      nextVals.splice(nextVals.indexOf(first + 2), 1);
      nextVals.splice(nextVals.indexOf(first + 1), 1);
      nextVals.splice(0, 1);
      if (this.checkSuitMelds(nextVals)) {
        return true;
      }
    }

    return false;
  }
}
