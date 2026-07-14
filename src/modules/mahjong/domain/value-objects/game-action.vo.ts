export type GameActionType =
  | 'deal'
  | 'draw'
  | 'discard'
  | 'chi'
  | 'pon'
  | 'kan'
  | 'riichi'
  | 'tsumo'
  | 'ron';

export interface GameAction {
  sequence: number;
  playerId: string;
  type: GameActionType;
  tile?: {
    suit: string;
    value: number;
    type: string;
    id: string;
  };
  extra?: any;
  timestamp: number;
}
