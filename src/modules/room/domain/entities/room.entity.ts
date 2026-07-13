import { RoomPlayer } from '../value-objects/room-player.vo.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export class Room {
  constructor(
    public readonly id: string,
    public name: string,
    public hostId: string,
    public readonly ruleset: 'riichi' | 'chinese',
    public status: 'waiting' | 'playing',
    public readonly players: RoomPlayer[],
  ) {}

  addPlayer(player: RoomPlayer): void {
    if (this.players.length >= 4) {
      throw new DomainException('ROOM_FULL', 'Room is full');
    }
    if (this.players.some((p) => p.userId === player.userId)) {
      throw new DomainException('ALREADY_IN_ROOM', 'Player already in room');
    }
    this.players.push(player);
  }

  removePlayer(userId: string): void {
    const index = this.players.findIndex((p) => p.userId === userId);
    if (index === -1) {
      throw new DomainException(
        'PLAYER_NOT_IN_ROOM',
        'Player not found in room',
      );
    }
    this.players.splice(index, 1);

    if (this.hostId === userId && this.players.length > 0) {
      this.hostId = this.players[0].userId;
    }
  }

  toggleReady(userId: string, isReady: boolean): void {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) {
      throw new DomainException(
        'PLAYER_NOT_IN_ROOM',
        'Player not found in room',
      );
    }
    player.isReady = isReady;
  }

  canStart(): boolean {
    if (this.players.length !== 4) return false;
    return this.players.every((p) => p.userId === this.hostId || p.isReady);
  }

  start(): void {
    if (!this.canStart()) {
      throw new DomainException('CANNOT_START', 'Cannot start room');
    }
    this.status = 'playing';
  }
}
