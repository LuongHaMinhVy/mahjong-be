import { type ILeaderboardRepository } from '../../domain/repositories/leaderboard.repository.js';
import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { NotFoundException } from '../../../../shared/exceptions/domain.exception.js';

export interface GetLeaderboardInput {
  userId: string;
  page: number;
  limit: number;
}

export class GetLeaderboardUseCase {
  constructor(
    private readonly leaderboardRepository: ILeaderboardRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: GetLeaderboardInput) {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundException('User', input.userId);
    }

    const page = Math.max(1, input.page);
    const limit = Math.max(1, Math.min(100, input.limit));
    const offset = (page - 1) * limit;

    const [globalPage, userRank, userStats] = await Promise.all([
      this.leaderboardRepository.getGlobalRankings(limit, offset),
      this.leaderboardRepository.getUserRank(input.userId),
      this.leaderboardRepository.getUserStats(input.userId),
    ]);

    const totalPages = Math.ceil(globalPage.total / limit);

    return {
      data: globalPage.entries.map((entry, idx) => ({
        rank: offset + idx + 1,
        userId: entry.userId,
        displayName: entry.displayName,
        avatar: entry.avatar,
        elo: entry.elo,
        stats: {
          totalGames: entry.totalGames,
          wins: entry.wins,
          winRate: entry.winRate,
        },
      })),
      meta: {
        total: globalPage.total,
        page,
        limit,
        totalPages,
      },
      currentUserRank: {
        rank: userRank,
        userId: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
        elo: user.elo,
        stats: {
          totalGames: userStats.totalGames,
          wins: userStats.wins,
          winRate:
            userStats.totalGames > 0
              ? userStats.wins / userStats.totalGames
              : 0,
        },
      },
    };
  }
}
