import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { LeaderboardController } from './presentation/controllers/leaderboard.controller.js';
import { GetLeaderboardUseCase } from './application/use-cases/get-leaderboard.use-case.js';
import { ILeaderboardRepository } from './domain/repositories/leaderboard.repository.js';
import { PrismaLeaderboardRepository } from './infrastructure/repositories/prisma-leaderboard.repository.js';
import { IUserRepository } from '../auth/domain/user.repository.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LeaderboardController],
  providers: [
    {
      provide: ILeaderboardRepository,
      useClass: PrismaLeaderboardRepository,
    },
    {
      provide: GetLeaderboardUseCase,
      inject: [ILeaderboardRepository, IUserRepository],
      useFactory: (
        leaderboardRepo: ILeaderboardRepository,
        userRepo: IUserRepository,
      ) => new GetLeaderboardUseCase(leaderboardRepo, userRepo),
    },
  ],
})
export class LeaderboardModule {}
