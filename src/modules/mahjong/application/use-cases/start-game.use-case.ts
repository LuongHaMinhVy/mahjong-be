import { Injectable } from '@nestjs/common';
import { GameEngine } from '../../domain/services/game-engine.js';
import { RiichiRuleset } from '../../domain/services/riichi.ruleset.js';
import { ChineseRuleset } from '../../domain/services/chinese.ruleset.js';
import { IGameStateRepository } from '../../domain/repositories/game-state.repository.js';
import { GameState } from '../../domain/entities/game-state.entity.js';

export interface StartGameDto {
  roomId: string;
  playerIds: string[];
  rulesetName: 'riichi' | 'chinese';
}

@Injectable()
export class StartGameUseCase {
  constructor(private readonly gameStateRepository: IGameStateRepository) {}

  async execute(dto: StartGameDto): Promise<GameState> {
    const ruleset =
      dto.rulesetName === 'riichi' ? new RiichiRuleset() : new ChineseRuleset();
    const engine = new GameEngine(ruleset);
    const gameState = engine.initializeGame(dto.roomId, dto.playerIds);
    await this.gameStateRepository.save(gameState);
    return gameState;
  }
}
