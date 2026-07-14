import { randomUUID } from 'crypto';
import { Room } from '../../domain/entities/room.entity.js';
import { RoomPlayer } from '../../domain/value-objects/room-player.vo.js';
import { type IRoomRepository } from '../../domain/repositories/room.repository.js';
import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { NotFoundException } from '../../../../shared/exceptions/domain.exception.js';

export interface CreateRoomInput {
  hostId: string;
  name: string;
  ruleset: 'riichi' | 'chinese';
}

export class CreateRoomUseCase {
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: CreateRoomInput): Promise<Room> {
    const host = await this.userRepository.findById(input.hostId);
    if (!host) {
      throw new NotFoundException('User', input.hostId);
    }

    const hostPlayer = new RoomPlayer(
      host.id,
      host.displayName,
      host.avatar,
      host.elo,
      false, // Host does not need to toggled-ready, or defaults to false
    );

    const roomId = randomUUID();
    const room = new Room(
      roomId,
      input.name,
      host.id,
      input.ruleset,
      'waiting',
      [hostPlayer],
    );

    await this.roomRepository.save(room);
    return room;
  }
}
