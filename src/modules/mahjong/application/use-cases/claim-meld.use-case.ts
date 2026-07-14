import { Injectable } from '@nestjs/common';
import { GameEngine } from '../../domain/services/game-engine.js';
import { RiichiRuleset } from '../../domain/services/riichi.ruleset.js';
import { ChineseRuleset } from '../../domain/services/chinese.ruleset.js';
import { IGameStateRepository } from '../../domain/repositories/game-state.repository.js';
import { MeldType } from '../../domain/value-objects/meld.vo.js';
import { Tile } from '../../domain/value-objects/tile.vo.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export interface ClaimMeldDto {
  gameId: string;
  playerId: string;
  meldType: MeldType;
  claimedTile: Tile;
  handTilesToUse: Tile[];
}

@Injectable()
export class ClaimMeldUseCase {
  constructor(private readonly gameStateRepository: IGameStateRepository) {}

  async execute(dto: ClaimMeldDto): Promise<void> {
    const state = await this.gameStateRepository.findById(dto.gameId);
    if (!state) {
      throw new DomainException('NOT_FOUND', 'Game not found.');
    }

    const ruleset =
      state.rulesetName === 'riichi'
        ? new RiichiRuleset()
        : new ChineseRuleset();
    const engine = new GameEngine(ruleset);

    engine.claimMeld(
      state,
      dto.playerId,
      dto.meldType,
      dto.claimedTile,
      dto.handTilesToUse,
    );

    const actionType = dto.meldType === 'closed-kan' ? 'kan' : (dto.meldType as any);
    state.addAction(dto.playerId, actionType, dto.claimedTile, {
      handTilesUsed: dto.handTilesToUse.map((t) => ({
        suit: t.suit,
        value: t.value,
        type: t.type,
        id: t.id,
      })),
    });

    await this.gameStateRepository.save(state);
  }
}
