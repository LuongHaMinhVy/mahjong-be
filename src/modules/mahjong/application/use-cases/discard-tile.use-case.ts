import { Injectable } from '@nestjs/common';
import { GameEngine } from '../../domain/services/game-engine.js';
import { RiichiRuleset } from '../../domain/services/riichi.ruleset.js';
import { ChineseRuleset } from '../../domain/services/chinese.ruleset.js';
import { IGameStateRepository } from '../../domain/repositories/game-state.repository.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export interface DiscardTileDto {
  gameId: string;
  playerId: string;
  tileId: string;
}

@Injectable()
export class DiscardTileUseCase {
  constructor(private readonly gameStateRepository: IGameStateRepository) {}

  async execute(dto: DiscardTileDto): Promise<void> {
    const state = await this.gameStateRepository.findById(dto.gameId);
    if (!state) {
      throw new DomainException('NOT_FOUND', 'Game not found.');
    }

    const ruleset =
      state.rulesetName === 'riichi'
        ? new RiichiRuleset()
        : new ChineseRuleset();
    const engine = new GameEngine(ruleset);

    const activePlayer = state.getCurrentPlayer();
    const tile = activePlayer.hand.find((t) => t.id === dto.tileId);
    if (!tile) {
      throw new DomainException('NOT_FOUND', 'Tile not found in hand.');
    }

    engine.discardTile(state, dto.playerId, dto.tileId);
    state.addAction(dto.playerId, 'discard', tile);
    await this.gameStateRepository.save(state);
  }
}
