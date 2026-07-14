import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { IGameStateRepository } from './domain/repositories/game-state.repository.js';
import { IGameResultRepository } from './domain/repositories/game-result.repository.js';
import { IGameReplayRepository } from './domain/repositories/game-replay.repository.js';
import { RedisGameStateRepository } from './infrastructure/repositories/redis-game-state.repository.js';
import { PrismaGameResultRepository } from './infrastructure/repositories/prisma-game-result.repository.js';
import { PrismaGameReplayRepository } from './infrastructure/repositories/prisma-game-replay.repository.js';

import { StartGameUseCase } from './application/use-cases/start-game.use-case.js';
import { DrawTileUseCase } from './application/use-cases/draw-tile.use-case.js';
import { DiscardTileUseCase } from './application/use-cases/discard-tile.use-case.js';
import { ClaimMeldUseCase } from './application/use-cases/claim-meld.use-case.js';
import { DeclareWinUseCase } from './application/use-cases/declare-win.use-case.js';
import { GetGameReplayUseCase } from './application/use-cases/get-game-replay.use-case.js';
import { GameGateway } from './presentation/websocket/game.gateway.js';
import { GameReplayController } from './presentation/controllers/game-replay.controller.js';

const USE_CASES = [
  StartGameUseCase,
  DrawTileUseCase,
  DiscardTileUseCase,
  ClaimMeldUseCase,
  DeclareWinUseCase,
  GetGameReplayUseCase,
];

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [GameReplayController],
  providers: [
    {
      provide: IGameStateRepository,
      useClass: RedisGameStateRepository,
    },
    {
      provide: IGameResultRepository,
      useClass: PrismaGameResultRepository,
    },
    {
      provide: IGameReplayRepository,
      useClass: PrismaGameReplayRepository,
    },
    ...USE_CASES,
    GameGateway,
  ],
  exports: [
    IGameStateRepository,
    IGameResultRepository,
    IGameReplayRepository,
    ...USE_CASES,
    GameGateway,
  ],
})
export class MahjongModule {}
