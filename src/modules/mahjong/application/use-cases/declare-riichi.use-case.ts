import { Injectable } from '@nestjs/common';
import { GameEngine } from '../../domain/services/game-engine.js';
import { RiichiRuleset } from '../../domain/services/riichi.ruleset.js';
import { IGameStateRepository } from '../../domain/repositories/game-state.repository.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export interface DeclareRiichiDto {
  gameId: string;
  playerId: string;
  tileId: string;
}

@Injectable()
export class DeclareRiichiUseCase {
  constructor(private readonly gameStateRepository: IGameStateRepository) {}

  async execute(dto: DeclareRiichiDto): Promise<void> {
    const state = await this.gameStateRepository.findById(dto.gameId);
    if (!state) {
      throw new DomainException('NOT_FOUND', 'Game not found.');
    }

    if (state.rulesetName !== 'riichi') {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Riichi can only be declared in Riichi ruleset.',
      );
    }

    if (state.phase !== 'playing') {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Game is not in playing phase.',
      );
    }

    const player = state.getCurrentPlayer();
    if (player.userId !== dto.playerId) {
      throw new DomainException('VALIDATION_ERROR', 'It is not your turn.');
    }

    if (player.isRiichi) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'You have already declared Riichi.',
      );
    }

    if (player.score < 1000) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Not enough points to declare Riichi.',
      );
    }

    // Closed hand check: all melds must be concealed
    const isOpen = player.melds.some((m) => !m.isConcealed);
    if (isOpen) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Cannot declare Riichi with an open hand.',
      );
    }

    const tileIndex = player.hand.findIndex((t) => t.id === dto.tileId);
    if (tileIndex === -1) {
      throw new DomainException('NOT_FOUND', 'Tile not found in hand.');
    }

    // Tenpai check on remaining 13 tiles after removing the chosen discard
    const tempHand = [...player.hand];
    const [discardedTile] = tempHand.splice(tileIndex, 1);

    const ruleset = new RiichiRuleset();
    const isTenpai = ruleset.isTenpai(tempHand);
    if (!isTenpai) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Hand is not in Tenpai after this discard.',
      );
    }

    // Deduct 1000 points
    player.score -= 1000;
    player.isRiichi = true;

    // Add riichi action to history
    state.addAction(dto.playerId, 'riichi', discardedTile);

    // Call game engine discard to process the actual discard and advance turn
    const engine = new GameEngine(ruleset);
    engine.discardTile(state, dto.playerId, dto.tileId);
    state.addAction(dto.playerId, 'discard', discardedTile);

    // Save state
    await this.gameStateRepository.save(state);
  }
}
