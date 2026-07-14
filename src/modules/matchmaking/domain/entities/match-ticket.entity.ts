export class MatchTicket {
  constructor(
    public readonly id: string,
    public readonly ruleset: 'riichi' | 'chinese',
    public readonly players: string[],
    public readonly acceptedPlayers: string[],
    public readonly createdAt: Date,
  ) {}

  isFullyAccepted(): boolean {
    return (
      this.players.length === this.acceptedPlayers.length &&
      this.players.every((p) => this.acceptedPlayers.includes(p))
    );
  }
}
