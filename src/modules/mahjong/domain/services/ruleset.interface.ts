import { type Tile } from '../value-objects/tile.vo.js';

export interface WinResult {
  isWin: boolean;
  yakuNames?: string[];
  fanNames?: string[];
  fanCount?: number;
  han?: number;
  fu?: number;
}

export interface ScoreResult {
  winnerId: string;
  points: number;
  scoreMap: Record<string, number>; // userId -> point changes (positive or negative)
}

export interface GameContext {
  round: number;
  honba: number;
  dora: Tile[];
  isWinnerDealer: boolean;
  isSelfDraw: boolean; // Tsumo vs Ron
  discarderId?: string;
  riichiPlayers: string[];
}

export abstract class IRuleset {
  abstract readonly name: 'riichi' | 'chinese';
  abstract readonly initialHandSize: number;
  abstract buildTileSet(): Tile[];
  abstract canChi(hand: Tile[], tile: Tile, fromPosition: number): boolean;
  abstract canPon(hand: Tile[], tile: Tile): boolean;
  abstract canKan(hand: Tile[], tile: Tile): boolean;
  abstract canWin(hand: Tile[], tile: Tile | null): WinResult | null;
  abstract calculateScore(
    win: WinResult,
    winnerId: string,
    playerIds: string[],
    context: GameContext,
  ): ScoreResult;
}
