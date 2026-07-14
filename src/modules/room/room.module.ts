import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { IRoomRepository } from './domain/repositories/room.repository.js';
import { RedisRoomRepository } from './infrastructure/repositories/redis-room.repository.js';
import { CreateRoomUseCase } from './application/use-cases/create-room.use-case.js';
import { JoinRoomUseCase } from './application/use-cases/join-room.use-case.js';
import { LeaveRoomUseCase } from './application/use-cases/leave-room.use-case.js';
import { ToggleReadyUseCase } from './application/use-cases/toggle-ready.use-case.js';
import { StartGameUseCase } from './application/use-cases/start-game.use-case.js';
import { LobbyService } from './application/services/lobby.service.js';
import { RoomGateway } from './presentation/websocket/room.gateway.js';

const USE_CASES = [
  CreateRoomUseCase,
  JoinRoomUseCase,
  LeaveRoomUseCase,
  ToggleReadyUseCase,
  StartGameUseCase,
];

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [
    {
      provide: IRoomRepository,
      useClass: RedisRoomRepository,
    },
    ...USE_CASES,
    LobbyService,
    RoomGateway,
  ],
  exports: [IRoomRepository, ...USE_CASES, LobbyService, RoomGateway],
})
export class RoomModule {}
