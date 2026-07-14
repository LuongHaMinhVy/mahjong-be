import { type IRoomRepository } from '../../../room/domain/repositories/room.repository.js';
import { type Room } from '../../../room/domain/entities/room.entity.js';

export class AdminGetRoomsUseCase {
  constructor(private readonly roomRepository: IRoomRepository) {}

  async execute(): Promise<Room[]> {
    return this.roomRepository.findAll();
  }
}
