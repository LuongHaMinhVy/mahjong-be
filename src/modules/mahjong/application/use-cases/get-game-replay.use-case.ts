import { Injectable } from '@nestjs/common';
import { IGameReplayRepository, type GameReplay } from '../../domain/repositories/game-replay.repository.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

@Injectable()
export class GetGameReplayUseCase {
  constructor(private readonly gameReplayRepository: IGameReplayRepository) {}

  async execute(gameResultId: string): Promise<GameReplay> {
    const replay = await this.gameReplayRepository.findByGameResultId(gameResultId);
    if (!replay) {
      throw new DomainException('NOT_FOUND', 'Không tìm thấy thông tin replay cho trận đấu này.');
    }
    return replay;
  }
}
