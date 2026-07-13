import { type GameResult } from '../entities/game-result.entity.js';

export abstract class IGameResultRepository {
  abstract save(gameResult: GameResult): Promise<void>;
  abstract findById(id: string): Promise<GameResult | null>;
  abstract findByPlayerId(playerId: string): Promise<GameResult[]>;
}
