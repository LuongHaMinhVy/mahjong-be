import { GameResult } from '../../../mahjong/domain/entities/game-result.entity.js';
import { UserStats } from '../value-objects/user-stats.vo.js';

export abstract class IUserStatsRepository {
  abstract getStats(userId: string): Promise<UserStats>;
  abstract getMatchHistory(
    userId: string,
    limit: number,
    offset: number
  ): Promise<GameResult[]>;
}
