export class RoomPlayer {
  constructor(
    public readonly userId: string,
    public readonly displayName: string,
    public readonly avatar: string | null,
    public readonly elo: number,
    public isReady: boolean = false,
  ) {}
}
