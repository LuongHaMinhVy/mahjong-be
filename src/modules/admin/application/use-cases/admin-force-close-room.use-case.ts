import { type IRoomRepository } from '../../../room/domain/repositories/room.repository.js';
import { NotFoundException } from '../../../../shared/exceptions/domain.exception.js';

export interface AdminForceCloseRoomInput {
  roomId: string;
}

export class AdminForceCloseRoomUseCase {
  constructor(private readonly roomRepository: IRoomRepository) {}

  async execute(input: AdminForceCloseRoomInput): Promise<void> {
    const room = await this.roomRepository.findById(input.roomId);
    if (!room) {
      throw new NotFoundException('Room', input.roomId);
    }

    await this.roomRepository.delete(input.roomId);
  }
}
