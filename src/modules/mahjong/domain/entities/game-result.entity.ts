export interface GameResultPlayer {
  userId: string;
  displayName: string;
  score: number;
  pointChange: number;
  isWinner: boolean;
}

export class GameResult {
  constructor(
    readonly id: string,
    readonly roomId: string,
    readonly rulesetName: 'riichi' | 'chinese',
    readonly winnerId: string | null,
    readonly players: GameResultPlayer[],
    readonly createdAt: Date,
  ) {}
}
