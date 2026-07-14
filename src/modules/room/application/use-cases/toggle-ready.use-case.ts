import { type Room } from '../../domain/entities/room.entity.js';
import { type IRoomRepository } from '../../domain/repositories/room.repository.js';
import { NotFoundException } from '../../../../shared/exceptions/domain.exception.js';

export interface ToggleReadyInput {
  userId: string;
  roomId: string;
  isReady: boolean;
}

export class ToggleReadyUseCase {
  constructor(private readonly roomRepository: IRoomRepository) {}

  async execute(input: ToggleReadyInput): Promise<Room> {
    const room = await this.roomRepository.findById(input.roomId);
    if (!room) {
      throw new NotFoundException('Room', input.roomId);
    }

    room.toggleReady(input.userId, input.isReady);
    await this.roomRepository.save(room);
    return room;
  }
}
