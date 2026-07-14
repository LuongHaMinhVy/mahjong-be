import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RoomModule } from '../room/room.module.js';
import { MatchmakingModule } from '../matchmaking/matchmaking.module.js';
import { AdminController } from './presentation/controllers/admin.controller.js';
import { AdminGetUsersUseCase } from './application/use-cases/admin-get-users.use-case.js';
import { AdminBanUserUseCase } from './application/use-cases/admin-ban-user.use-case.js';
import { AdminUpdateEloUseCase } from './application/use-cases/admin-update-elo.use-case.js';
import { AdminGetRoomsUseCase } from './application/use-cases/admin-get-rooms.use-case.js';
import { AdminForceCloseRoomUseCase } from './application/use-cases/admin-force-close-room.use-case.js';
import { AdminGetMatchmakingUseCase } from './application/use-cases/admin-get-matchmaking.use-case.js';
import { AdminCancelTicketUseCase } from './application/use-cases/admin-cancel-ticket.use-case.js';
import { IUserRepository } from '../auth/domain/user.repository.js';
import { IRoomRepository } from '../room/domain/repositories/room.repository.js';
import { IMatchmakingRepository } from '../matchmaking/domain/repositories/matchmaking.repository.js';

@Module({
  imports: [AuthModule, RoomModule, MatchmakingModule],
  controllers: [AdminController],
  providers: [
    {
      provide: AdminGetUsersUseCase,
      useFactory: (userRepo: IUserRepository) => new AdminGetUsersUseCase(userRepo),
      inject: [IUserRepository],
    },
    {
      provide: AdminBanUserUseCase,
      useFactory: (userRepo: IUserRepository) => new AdminBanUserUseCase(userRepo),
      inject: [IUserRepository],
    },
    {
      provide: AdminUpdateEloUseCase,
      useFactory: (userRepo: IUserRepository) => new AdminUpdateEloUseCase(userRepo),
      inject: [IUserRepository],
    },
    {
      provide: AdminGetRoomsUseCase,
      useFactory: (roomRepo: IRoomRepository) => new AdminGetRoomsUseCase(roomRepo),
      inject: [IRoomRepository],
    },
    {
      provide: AdminForceCloseRoomUseCase,
      useFactory: (roomRepo: IRoomRepository) => new AdminForceCloseRoomUseCase(roomRepo),
      inject: [IRoomRepository],
    },
    {
      provide: AdminGetMatchmakingUseCase,
      useFactory: (matchmakingRepo: IMatchmakingRepository) =>
        new AdminGetMatchmakingUseCase(matchmakingRepo),
      inject: [IMatchmakingRepository],
    },
    {
      provide: AdminCancelTicketUseCase,
      useFactory: (matchmakingRepo: IMatchmakingRepository) =>
        new AdminCancelTicketUseCase(matchmakingRepo),
      inject: [IMatchmakingRepository],
    },
  ],
})
export class AdminModule {}
