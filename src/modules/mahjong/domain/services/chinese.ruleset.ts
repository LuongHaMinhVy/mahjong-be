import {
  IRuleset,
  type WinResult,
  type ScoreResult,
  type GameContext,
} from './ruleset.interface.js';
import { Tile } from '../value-objects/tile.vo.js';

export class ChineseRuleset extends IRuleset {
  readonly name = 'chinese';
  readonly initialHandSize = 13;

  buildTileSet(): Tile[] {
    const tiles: Tile[] = [];

    // Man, Pin, Sou
    const suits: ('man' | 'pin' | 'sou')[] = ['man', 'pin', 'sou'];
    for (const suit of suits) {
      for (let val = 1; val <= 9; val++) {
        for (let copy = 0; copy < 4; copy++) {
          tiles.push(
            Tile.create(suit, val, 'number', `cn-${suit}-${val}-${copy}`),
          );
        }
      }
    }

    // Winds (1: East, 2: South, 3: West, 4: North)
    for (let val = 1; val <= 4; val++) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push(Tile.create('honor', val, 'wind', `cn-wind-${val}-${copy}`));
      }
    }

    // Dragons (1: Red, 2: White, 3: Green)
    for (let val = 1; val <= 3; val++) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push(
          Tile.create('honor', val, 'dragon', `cn-dragon-${val}-${copy}`),
        );
      }
    }

    // Flowers (1 to 4)
    for (let val = 1; val <= 4; val++) {
      tiles.push(Tile.create('flower', val, 'flower', `cn-flower-${val}`));
    }

    // Seasons (1 to 4)
    for (let val = 1; val <= 4; val++) {
      tiles.push(Tile.create('flower', val, 'season', `cn-season-${val}`));
    }

    return tiles;
  }

  canChi(hand: Tile[], tile: Tile, fromPosition: number): boolean {
    if (tile.type !== 'number') return false;

    // Chi is allowed from the left player (fromPosition = 3)
    if (fromPosition !== 3) {
      return false;
    }

    const val = tile.value;
    const suit = tile.suit;

    const has = (v: number) =>
      hand.some((t) => t.suit === suit && t.value === v);

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

    // Flowers/Seasons are ignored for standard winning shape (they are bonus tiles kept aside)
    // For standard win, filter out flower tiles if any are in the main hand
    const regularTiles = fullHand.filter((t) => t.suit !== 'flower');

    const isStandard = this.checkStandardShape(regularTiles);
    if (!isStandard) {
      return { isWin: false };
    }

    // In Chinese Classical, any standard hand is a win (no minimum Fan required)
    // Let's identify any simple Fan combinations if they exist
    const fanNames: string[] = [];
    let fanCount = 0;

    // Pure Suit (Clean Sanitised hand): all regular tiles are of the same suit (man/pin/sou)
    const distinctSuits = Array.from(new Set(regularTiles.map((t) => t.suit)));
    if (distinctSuits.length === 1 && distinctSuits[0] !== 'honor') {
      fanNames.push('Clean Suit');
      fanCount += 6; // standard 6 Fan for Clean Suit
    }

    return {
      isWin: true,
      fanNames,
      fanCount,
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

    const fan = win.fanCount || 0;
    const baseMultiplier = 1; // 1 point per Fan
    const pointsPerPlayer = fan > 0 ? fan * baseMultiplier : 1; // 1 point minimum

    let totalPoints = 0;

    if (context.isSelfDraw) {
      // Tsumo: every other player pays the points
      totalPoints = pointsPerPlayer * 3;
      for (const pid of playerIds) {
        if (pid !== winnerId) {
          scoreMap[pid] = -pointsPerPlayer;
        }
      }
      scoreMap[winnerId] = totalPoints;
    } else {
      // Ron: only discarder pays (or sometimes split, but let's implement discarder pays)
      totalPoints = pointsPerPlayer;
      const discarder =
        context.discarderId || playerIds.find((pid) => pid !== winnerId) || '';
      scoreMap[discarder] = -totalPoints;
      scoreMap[winnerId] = totalPoints;
    }

    return { winnerId, points: totalPoints, scoreMap };
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
