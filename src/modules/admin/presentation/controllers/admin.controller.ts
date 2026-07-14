import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../../../auth/presentation/guards/jwt.guard.js';
import { RolesGuard } from '../../../../shared/guards/roles.guard.js';
import { Roles } from '../../../../shared/decorators/roles.decorator.js';
import { QueryUsersDto } from '../dto/query-users.dto.js';
import { BanUserDto } from '../dto/ban-user.dto.js';
import { UpdateEloDto } from '../dto/update-elo.dto.js';
import { AdminGetUsersUseCase } from '../../application/use-cases/admin-get-users.use-case.js';
import { AdminBanUserUseCase } from '../../application/use-cases/admin-ban-user.use-case.js';
import { AdminUpdateEloUseCase } from '../../application/use-cases/admin-update-elo.use-case.js';
import { AdminGetRoomsUseCase } from '../../application/use-cases/admin-get-rooms.use-case.js';
import { AdminForceCloseRoomUseCase } from '../../application/use-cases/admin-force-close-room.use-case.js';
import { AdminGetMatchmakingUseCase } from '../../application/use-cases/admin-get-matchmaking.use-case.js';
import { AdminCancelTicketUseCase } from '../../application/use-cases/admin-cancel-ticket.use-case.js';

@Controller('admin')
@UseGuards(JwtGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly getUsersUseCase: AdminGetUsersUseCase,
    private readonly banUserUseCase: AdminBanUserUseCase,
    private readonly updateEloUseCase: AdminUpdateEloUseCase,
    private readonly getRoomsUseCase: AdminGetRoomsUseCase,
    private readonly forceCloseRoomUseCase: AdminForceCloseRoomUseCase,
    private readonly getMatchmakingUseCase: AdminGetMatchmakingUseCase,
    private readonly cancelTicketUseCase: AdminCancelTicketUseCase,
  ) {}

  @Get('users')
  async getUsers(@Query() query: QueryUsersDto) {
    const result = await this.getUsersUseCase.execute(query);
    return {
      users: result.users.map((u) => ({
        id: u.id,
        email: u.email.getValue(),
        displayName: u.displayName,
        avatar: u.avatar,
        elo: u.elo,
        isEmailVerified: u.isEmailVerified,
        role: u.role,
        bannedUntil: u.bannedUntil,
      })),
      total: result.total,
    };
  }

  @Post('users/:id/ban')
  async banUser(@Param('id') userId: string, @Body() body: BanUserDto) {
    await this.banUserUseCase.execute({
      userId,
      durationMinutes:
        body.durationMinutes !== undefined ? body.durationMinutes : null,
    });
    return {
      message:
        body.durationMinutes !== undefined
          ? 'User banned successfully'
          : 'User unbanned successfully',
    };
  }

  @Put('users/:id/elo')
  async updateElo(@Param('id') userId: string, @Body() body: UpdateEloDto) {
    await this.updateEloUseCase.execute({
      userId,
      newElo: body.elo,
    });
    return { message: 'User ELO updated successfully' };
  }

  @Get('rooms')
  async getRooms() {
    const rooms = await this.getRoomsUseCase.execute();
    return rooms.map((r) => ({
      id: r.id,
      name: r.name,
      hostId: r.hostId,
      ruleset: r.ruleset,
      status: r.status,
      playersCount: r.players.length,
      players: r.players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        elo: p.elo,
        isReady: p.isReady,
      })),
    }));
  }

  @Delete('rooms/:id')
  async forceCloseRoom(@Param('id') roomId: string) {
    await this.forceCloseRoomUseCase.execute({ roomId });
    return { message: 'Room force closed successfully' };
  }

  @Get('matchmaking')
  async getMatchmaking() {
    const queues = await this.getMatchmakingUseCase.execute();
    return {
      riichi: queues.riichi.map((q) => ({
        userId: q.userId,
        elo: q.elo,
        joinedAt: q.joinedAt,
      })),
      chinese: queues.chinese.map((q) => ({
        userId: q.userId,
        elo: q.elo,
        joinedAt: q.joinedAt,
      })),
    };
  }

  @Delete('matchmaking/tickets/:id')
  async cancelTicket(@Param('id') ticketId: string) {
    await this.cancelTicketUseCase.execute({ ticketId });
    return { message: 'Matchmaking ticket cancelled successfully' };
  }
}
