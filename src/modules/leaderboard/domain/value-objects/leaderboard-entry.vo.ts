export class LeaderboardEntry {
  constructor(
    public readonly userId: string,
    public readonly displayName: string,
    public readonly avatar: string | null,
    public readonly elo: number,
    public readonly totalGames: number,
    public readonly wins: number,
  ) {}

  get winRate(): number {
    return this.totalGames > 0 ? this.wins / this.totalGames : 0;
  }
}
