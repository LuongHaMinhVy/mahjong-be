import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IMatchmakingRepository } from './domain/repositories/matchmaking.repository.js';
import { RedisMatchmakingRepository } from './infrastructure/repositories/redis-matchmaking.repository.js';
import { JoinQueueUseCase } from './application/use-cases/join-queue.use-case.js';
import { LeaveQueueUseCase } from './application/use-cases/leave-queue.use-case.js';
import { RespondToMatchUseCase } from './application/use-cases/respond-to-match.use-case.js';
import { MatchmakingProcessor } from './application/services/matchmaking-processor.service.js';
import { MatchmakingGateway } from './presentation/websocket/matchmaking.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { RoomModule } from '../room/room.module.js';
import { CreateRoomUseCase } from '../room/application/use-cases/create-room.use-case.js';
import { JoinRoomUseCase } from '../room/application/use-cases/join-room.use-case.js';
import { ToggleReadyUseCase } from '../room/application/use-cases/toggle-ready.use-case.js';
import { StartGameUseCase } from '../room/application/use-cases/start-game.use-case.js';
import { IUserRepository } from '../auth/domain/user.repository.js';

@Module({
  imports: [AuthModule, RoomModule],
  providers: [
    {
      provide: IMatchmakingRepository,
      useClass: RedisMatchmakingRepository,
    },
    {
      provide: JoinQueueUseCase,
      useFactory: (repo: IMatchmakingRepository, userRepo: IUserRepository) => new JoinQueueUseCase(repo, userRepo),
      inject: [IMatchmakingRepository, IUserRepository],
    },
    {
      provide: LeaveQueueUseCase,
      useFactory: (repo: IMatchmakingRepository) => new LeaveQueueUseCase(repo),
      inject: [IMatchmakingRepository],
    },
    {
      provide: RespondToMatchUseCase,
      useFactory: (
        repo: IMatchmakingRepository,
        createRoom: CreateRoomUseCase,
        joinRoom: JoinRoomUseCase,
        toggleReady: ToggleReadyUseCase,
        startGame: StartGameUseCase
      ) => new RespondToMatchUseCase(repo, createRoom, joinRoom, toggleReady, startGame),
      inject: [
        IMatchmakingRepository,
        CreateRoomUseCase,
        JoinRoomUseCase,
        ToggleReadyUseCase,
        StartGameUseCase,
      ],
    },
    MatchmakingGateway,
    {
      provide: MatchmakingProcessor,
      useFactory: (repo: IMatchmakingRepository, gateway: MatchmakingGateway) =>
        new MatchmakingProcessor(repo, gateway),
      inject: [IMatchmakingRepository, MatchmakingGateway],
    },
  ],
  exports: [
    IMatchmakingRepository,
    JoinQueueUseCase,
    LeaveQueueUseCase,
    RespondToMatchUseCase,
    MatchmakingGateway,
    MatchmakingProcessor,
  ],
})
export class MatchmakingModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly processor: MatchmakingProcessor) {}

  onModuleInit() {
    this.processor.start();
  }

  onModuleDestroy() {
    this.processor.stop();
  }
}
