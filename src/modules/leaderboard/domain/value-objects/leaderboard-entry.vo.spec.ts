import { LeaderboardEntry } from './leaderboard-entry.vo.js';

describe('LeaderboardEntry', () => {
  it('should compute win rate correctly', () => {
    const entry = new LeaderboardEntry('1', 'Player 1', null, 1200, 10, 4);
    expect(entry.winRate).toBe(0.4);
  });

  it('should return 0 win rate if no games played', () => {
    const entry = new LeaderboardEntry('1', 'Player 1', null, 1000, 0, 0);
    expect(entry.winRate).toBe(0);
  });
});
