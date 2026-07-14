import { type GameAction } from '../value-objects/game-action.vo.js';

export interface GameReplay {
  id: string;
  gameResultId: string;
  actions: GameAction[];
  createdAt: Date;
}

export abstract class IGameReplayRepository {
  abstract save(gameResultId: string, actions: GameAction[]): Promise<GameReplay>;
  abstract findByGameResultId(gameResultId: string): Promise<GameReplay | null>;
}
