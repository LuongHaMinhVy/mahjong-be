import { Injectable } from '@nestjs/common';
import { IUserStatsRepository } from '../../domain/repositories/user-stats.repository.js';
import { GameResult } from '../../../mahjong/domain/entities/game-result.entity.js';

export interface GetMatchHistoryQuery {
  limit?: number;
  offset?: number;
}

@Injectable()
export class GetMatchHistoryUseCase {
  constructor(private readonly userStatsRepo: IUserStatsRepository) {}

  async execute(
    userId: string,
    query: GetMatchHistoryQuery,
  ): Promise<GameResult[]> {
    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;
    return this.userStatsRepo.getMatchHistory(userId, limit, offset);
  }
}
