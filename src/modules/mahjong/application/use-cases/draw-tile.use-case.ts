import { Injectable } from '@nestjs/common';
import { GameEngine } from '../../domain/services/game-engine.js';
import { RiichiRuleset } from '../../domain/services/riichi.ruleset.js';
import { ChineseRuleset } from '../../domain/services/chinese.ruleset.js';
import { IGameStateRepository } from '../../domain/repositories/game-state.repository.js';
import { Tile } from '../../domain/value-objects/tile.vo.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export interface DrawTileDto {
  gameId: string;
}

@Injectable()
export class DrawTileUseCase {
  constructor(private readonly gameStateRepository: IGameStateRepository) {}

  async execute(dto: DrawTileDto): Promise<Tile> {
    const state = await this.gameStateRepository.findById(dto.gameId);
    if (!state) {
      throw new DomainException('NOT_FOUND', 'Game not found.');
    }

    const ruleset =
      state.rulesetName === 'riichi'
        ? new RiichiRuleset()
        : new ChineseRuleset();
    const engine = new GameEngine(ruleset);

    const tile = engine.drawTile(state);
    await this.gameStateRepository.save(state);
    return tile;
  }
}
