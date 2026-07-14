import { type LeaderboardEntry } from '../value-objects/leaderboard-entry.vo.js';

export interface LeaderboardPage {
  entries: LeaderboardEntry[];
  total: number;
}

export abstract class ILeaderboardRepository {
  abstract getGlobalRankings(
    limit: number,
    offset: number,
  ): Promise<LeaderboardPage>;
  abstract getUserRank(userId: string): Promise<number>;
  abstract getUserStats(
    userId: string,
  ): Promise<{ totalGames: number; wins: number }>;
}
