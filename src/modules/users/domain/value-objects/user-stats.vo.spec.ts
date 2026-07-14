import { type UserStats } from './user-stats.vo.js';

describe('UserStats interface structure', () => {
  it('should define correct properties for UserStats', () => {
    const stats: UserStats = {
      totalGames: 10,
      wins: 4,
      winRate: 0.4,
      currentElo: 1050,
    };
    expect(stats.totalGames).toBe(10);
    expect(stats.wins).toBe(4);
    expect(stats.winRate).toBe(0.4);
    expect(stats.currentElo).toBe(1050);
  });
});
