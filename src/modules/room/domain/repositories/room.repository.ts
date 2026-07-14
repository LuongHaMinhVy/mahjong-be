import { type Room } from '../entities/room.entity.js';

export abstract class IRoomRepository {
  abstract save(room: Room): Promise<void>;
  abstract findById(id: string): Promise<Room | null>;
  abstract delete(id: string): Promise<void>;
  abstract findAllWaiting(): Promise<Room[]>;
}
