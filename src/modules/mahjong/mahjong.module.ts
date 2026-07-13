import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { IGameStateRepository } from './domain/repositories/game-state.repository.js';
import { IGameResultRepository } from './domain/repositories/game-result.repository.js';
import { RedisGameStateRepository } from './infrastructure/repositories/redis-game-state.repository.js';
import { PrismaGameResultRepository } from './infrastructure/repositories/prisma-game-result.repository.js';

import { StartGameUseCase } from './application/use-cases/start-game.use-case.js';
import { DrawTileUseCase } from './application/use-cases/draw-tile.use-case.js';
import { DiscardTileUseCase } from './application/use-cases/discard-tile.use-case.js';
import { ClaimMeldUseCase } from './application/use-cases/claim-meld.use-case.js';
import { DeclareWinUseCase } from './application/use-cases/declare-win.use-case.js';

const USE_CASES = [
  StartGameUseCase,
  DrawTileUseCase,
  DiscardTileUseCase,
  ClaimMeldUseCase,
  DeclareWinUseCase,
];

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [
    {
      provide: IGameStateRepository,
      useClass: RedisGameStateRepository,
    },
    {
      provide: IGameResultRepository,
      useClass: PrismaGameResultRepository,
    },
    ...USE_CASES,
  ],
  exports: [IGameStateRepository, IGameResultRepository, ...USE_CASES],
})
export class MahjongModule {}
