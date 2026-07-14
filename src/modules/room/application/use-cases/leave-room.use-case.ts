import { type IRoomRepository } from '../../domain/repositories/room.repository.js';
import { NotFoundException } from '../../../../shared/exceptions/domain.exception.js';

export interface LeaveRoomInput {
  userId: string;
  roomId: string;
}

export interface LeaveRoomResult {
  closed: boolean;
  newHostId?: string;
}

export class LeaveRoomUseCase {
  constructor(private readonly roomRepository: IRoomRepository) {}

  async execute(input: LeaveRoomInput): Promise<LeaveRoomResult> {
    const room = await this.roomRepository.findById(input.roomId);
    if (!room) {
      throw new NotFoundException('Room', input.roomId);
    }

    room.removePlayer(input.userId);

    if (room.players.length === 0) {
      await this.roomRepository.delete(room.id);
      return { closed: true };
    }

    await this.roomRepository.save(room);
    return {
      closed: false,
      newHostId: room.hostId,
    };
  }
}
