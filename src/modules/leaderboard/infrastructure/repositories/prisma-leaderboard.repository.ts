import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { type ILeaderboardRepository, type LeaderboardPage } from '../../domain/repositories/leaderboard.repository.js';
import { LeaderboardEntry } from '../../domain/value-objects/leaderboard-entry.vo.js';

@Injectable()
export class PrismaLeaderboardRepository implements ILeaderboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getGlobalRankings(limit: number, offset: number): Promise<LeaderboardPage> {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { elo: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count(),
    ]);

    const entries = await Promise.all(
      users.map(async (u) => {
        const stats = await this.getUserStats(u.id);
        return new LeaderboardEntry(u.id, u.displayName, u.avatar, u.elo, stats.totalGames, stats.wins);
      })
    );

    return { entries, total };
  }

  async getUserRank(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return 0;

    const count = await this.prisma.user.count({
      where: { elo: { gt: user.elo } },
    });
    return count + 1;
  }

  async getUserStats(userId: string): Promise<{ totalGames: number; wins: number }> {
    const results = await this.prisma.gameResult.findMany({
      where: {
        playersJson: {
          path: [],
          array_contains: [{ userId }],
        },
      },
    });

    const totalGames = results.length;
    const wins = results.filter((r) => r.winnerId === userId).length;

    return { totalGames, wins };
  }
}
