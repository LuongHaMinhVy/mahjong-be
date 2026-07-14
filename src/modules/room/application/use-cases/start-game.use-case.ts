import { type Room } from '../../domain/entities/room.entity.js';
import { type IRoomRepository } from '../../domain/repositories/room.repository.js';
import {
  NotFoundException,
  UnauthorizedException,
} from '../../../../shared/exceptions/domain.exception.js';

export interface StartGameInput {
  hostId: string;
  roomId: string;
}

export class StartGameUseCase {
  constructor(private readonly roomRepository: IRoomRepository) {}

  async execute(input: StartGameInput): Promise<Room> {
    const room = await this.roomRepository.findById(input.roomId);
    if (!room) {
      throw new NotFoundException('Room', input.roomId);
    }

    if (room.hostId !== input.hostId) {
      throw new UnauthorizedException('Only the host can start the game');
    }

    room.start();
    await this.roomRepository.save(room);
    return room;
  }
}
