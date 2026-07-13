import { type GameState } from '../entities/game-state.entity.js';

export abstract class IGameStateRepository {
  abstract save(gameState: GameState): Promise<void>;
  abstract findById(id: string): Promise<GameState | null>;
  abstract delete(id: string): Promise<void>;
}
