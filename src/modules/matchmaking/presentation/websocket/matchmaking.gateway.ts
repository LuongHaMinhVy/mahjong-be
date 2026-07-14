import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { WsAuthGuard } from '../../../../shared/websocket/ws-auth.guard.js';
import { JoinQueueUseCase } from '../../application/use-cases/join-queue.use-case.js';
import { LeaveQueueUseCase } from '../../application/use-cases/leave-queue.use-case.js';
import { RespondToMatchUseCase } from '../../application/use-cases/respond-to-match.use-case.js';
import { type IMatchmakingLobbyGateway } from '../../application/services/matchmaking-processor.service.js';
import { type JwtPayload } from '../../../../shared/decorators/current-user.decorator.js';

@WebSocketGateway({
  namespace: 'matchmaking',
  cors: { origin: '*' },
})
@UseGuards(WsAuthGuard)
export class MatchmakingGateway
  implements OnGatewayConnection, OnGatewayDisconnect, IMatchmakingLobbyGateway
{
  private readonly logger = new Logger(MatchmakingGateway.name);
  private readonly clientSockets = new Map<string, string>(); // userId -> socketId

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly joinQueueUseCase: JoinQueueUseCase,
    private readonly leaveQueueUseCase: LeaveQueueUseCase,
    private readonly respondToMatchUseCase: RespondToMatchUseCase,
  ) {}

  handleConnection(client: Socket) {
    const user = (client as Socket & { user?: JwtPayload }).user;
    if (user) {
      this.clientSockets.set(user.sub, client.id);
      this.logger.log(`User ${user.sub} connected to matchmaking`);
    }
  }

  handleDisconnect(client: Socket) {
    const user = (client as Socket & { user?: JwtPayload }).user;
    if (user) {
      this.clientSockets.delete(user.sub);
      this.logger.log(`User ${user.sub} disconnected from matchmaking`);
      this.leaveQueueUseCase.execute({ userId: user.sub, ruleset: 'riichi' }).catch(() => {});
      this.leaveQueueUseCase.execute({ userId: user.sub, ruleset: 'chinese' }).catch(() => {});
    }
  }

  @SubscribeMessage('matchmaking:join')
  async handleJoin(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { ruleset: 'riichi' | 'chinese' },
  ) {
    try {
      await this.joinQueueUseCase.execute({
        userId: client.user.sub,
        ruleset: data.ruleset,
      });
      client.emit('matchmaking:joined', { ruleset: data.ruleset });
    } catch (err) {
      client.emit('error', { message: (err as Error).message });
    }
  }

  @SubscribeMessage('matchmaking:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { ruleset: 'riichi' | 'chinese' },
  ) {
    try {
      await this.leaveQueueUseCase.execute({
        userId: client.user.sub,
        ruleset: data.ruleset,
      });
      client.emit('matchmaking:left', { ruleset: data.ruleset });
    } catch (err) {
      client.emit('error', { message: (err as Error).message });
    }
  }

  @SubscribeMessage('matchmaking:respond')
  async handleRespond(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { ticketId: string; accept: boolean },
  ) {
    try {
      const result = await this.respondToMatchUseCase.execute({
        userId: client.user.sub,
        ticketId: data.ticketId,
        accept: data.accept,
      });

      if (result.status === 'cancelled' && result.requeuedPlayers && result.cancelledPlayer) {
        const declinedSocketId = this.clientSockets.get(result.cancelledPlayer);
        if (declinedSocketId) {
          this.server.to(declinedSocketId).emit('matchmaking:cancelled', { reason: 'declined' });
        }

        for (const p of result.requeuedPlayers) {
          const sid = this.clientSockets.get(p);
          if (sid) {
            this.server.to(sid).emit('matchmaking:requeued');
          }
        }
      } else if (result.status === 'completed' && result.roomId) {
        const players = result.ticket ? result.ticket.players : [];
        for (const p of players) {
          const sid = this.clientSockets.get(p);
          if (sid) {
            this.server.to(sid).emit('matchmaking:success', { roomId: result.roomId });
          }
        }
      } else if (result.status === 'accepted' && result.ticket) {
        const payload = {
          acceptedCount: result.ticket.acceptedPlayers.length,
          totalCount: result.ticket.players.length,
        };
        for (const p of result.ticket.players) {
          const sid = this.clientSockets.get(p);
          if (sid) {
            this.server.to(sid).emit('matchmaking:status', payload);
          }
        }
      }
    } catch (err) {
      client.emit('error', { message: (err as Error).message });
    }
  }

  broadcastMatchFound(ticketId: string, playerIds: string[]): void {
    for (const p of playerIds) {
      const sid = this.clientSockets.get(p);
      if (sid) {
        this.server.to(sid).emit('matchmaking:found', { ticketId, timeout: 10 });
      }
    }
  }
}
