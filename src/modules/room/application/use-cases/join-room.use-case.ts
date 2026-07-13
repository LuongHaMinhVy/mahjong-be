import { Room } from '../../domain/entities/room.entity.js';
import { RoomPlayer } from '../../domain/value-objects/room-player.vo.js';
import { IRoomRepository } from '../../domain/repositories/room.repository.js';
import { IUserRepository } from '../../../auth/domain/user.repository.js';
import { NotFoundException } from '../../../../shared/exceptions/domain.exception.js';

export interface JoinRoomInput {
  userId: string;
  roomId: string;
}

export class JoinRoomUseCase {
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: JoinRoomInput): Promise<Room> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundException('User', input.userId);
    }

    const room = await this.roomRepository.findById(input.roomId);
    if (!room) {
      throw new NotFoundException('Room', input.roomId);
    }

    const player = new RoomPlayer(
      user.id,
      user.displayName,
      user.avatar,
      user.elo,
      false,
    );

    room.addPlayer(player);
    await this.roomRepository.save(room);
    return room;
  }
}
