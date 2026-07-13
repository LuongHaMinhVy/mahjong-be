import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersController } from './presentation/controllers/users.controller.js';
import { GetUserProfileUseCase } from './application/use-cases/get-user-profile.use-case.js';
import { UpdateUserProfileUseCase } from './application/use-cases/update-user-profile.use-case.js';
import { GetMatchHistoryUseCase } from './application/use-cases/get-match-history.use-case.js';
import { IUserStatsRepository } from './domain/repositories/user-stats.repository.js';
import { PrismaUserStatsRepository } from './infrastructure/repositories/prisma-user-stats.repository.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController],
  providers: [
    GetUserProfileUseCase,
    UpdateUserProfileUseCase,
    GetMatchHistoryUseCase,
    {
      provide: IUserStatsRepository,
      useClass: PrismaUserStatsRepository,
    },
  ],
})
export class UsersModule {}
