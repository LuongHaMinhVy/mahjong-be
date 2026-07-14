export class MatchmakingQueueEntry {
  constructor(
    public readonly userId: string,
    public readonly elo: number,
    public readonly joinedAt: Date,
  ) {}

  getAllowedEloGap(currentTime: Date): number {
    const elapsedSeconds = Math.max(0, Math.floor((currentTime.getTime() - this.joinedAt.getTime()) / 1000));
    return 100 + elapsedSeconds * 5;
  }
}
