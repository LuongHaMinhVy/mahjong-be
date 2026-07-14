/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { WsAuthGuard } from '../../../../shared/websocket/ws-auth.guard.js';
import { CreateRoomUseCase } from '../../application/use-cases/create-room.use-case.js';
import { JoinRoomUseCase } from '../../application/use-cases/join-room.use-case.js';
import { LeaveRoomUseCase } from '../../application/use-cases/leave-room.use-case.js';
import { ToggleReadyUseCase } from '../../application/use-cases/toggle-ready.use-case.js';
import { StartGameUseCase } from '../../application/use-cases/start-game.use-case.js';
import { LobbyService } from '../../application/services/lobby.service.js';
import { JwtPayload } from '../../../../shared/decorators/current-user.decorator.js';
import { Room } from '../../domain/entities/room.entity.js';
import { JwtTokenService } from '../../../auth/infrastructure/token/jwt-token.service.js';
import { IRoomRepository } from '../../domain/repositories/room.repository.js';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/room',
})
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RoomGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly lobbyService: LobbyService,
    private readonly createRoomUseCase: CreateRoomUseCase,
    private readonly joinRoomUseCase: JoinRoomUseCase,
    private readonly leaveRoomUseCase: LeaveRoomUseCase,
    private readonly toggleReadyUseCase: ToggleReadyUseCase,
    private readonly startGameUseCase: StartGameUseCase,
    private readonly roomRepository: IRoomRepository,
    private readonly jwtTokenService?: JwtTokenService, // Optional to avoid breaking unit tests
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected to /room: ${client.id}`);
    if (this.jwtTokenService) {
      const token = this.extractToken(client);
      if (token) {
        try {
          const payload = await this.jwtTokenService.verifyAccessToken(token);
          (client as any).user = payload;
          await this.lobbyService.setUserOnline(payload.sub);
          this.logger.log(`User ${payload.sub} marked online via connection`);
        } catch {
          // Ignored
        }
      }
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from /room: ${client.id}`);
    const userId = (client as any).user?.sub;
    if (userId) {
      await this.lobbyService.setUserOffline(userId);
      this.logger.log(`User ${userId} marked offline via disconnect`);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('room:create')
  async handleCreateRoom(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { name: string; ruleset: 'riichi' | 'chinese' },
  ) {
    const userId = client.user.sub;
    try {
      const room = await this.createRoomUseCase.execute({
        hostId: userId,
        name: data.name,
        ruleset: data.ruleset,
      });

      await client.join(room.id);
      this.broadcastRoomUpdate(room.id, room);
    } catch (err: any) {
      this.logger.error(`Room creation failed: ${err.message}`);
      client.emit('error', err.message);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.user.sub;
    try {
      const room = await this.joinRoomUseCase.execute({
        userId,
        roomId: data.roomId,
      });

      await client.join(room.id);
      this.broadcastRoomUpdate(room.id, room);
    } catch (err: any) {
      this.logger.error(`Room join failed: ${err.message}`);
      client.emit('error', err.message);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('room:leave')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.user.sub;
    try {
      const result = await this.leaveRoomUseCase.execute({
        userId,
        roomId: data.roomId,
      });

      await client.leave(data.roomId);
      if (!result.closed) {
        const room = await this.roomRepository.findById(data.roomId);
        if (room) {
          this.broadcastRoomUpdate(data.roomId, room);
        }
      } else {
        // Room was deleted because it is empty
        this.server.to(data.roomId).emit('room:deleted', { roomId: data.roomId });
      }
    } catch (err: any) {
      this.logger.error(`Room leave failed: ${err.message}`);
      client.emit('error', err.message);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('room:ready')
  async handleReady(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { roomId: string; isReady: boolean },
  ) {
    const userId = client.user.sub;
    try {
      const room = await this.toggleReadyUseCase.execute({
        userId,
        roomId: data.roomId,
        isReady: data.isReady,
      });

      this.broadcastRoomUpdate(data.roomId, room);
    } catch (err: any) {
      this.logger.error(`Room ready toggle failed: ${err.message}`);
      client.emit('error', err.message);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('room:start')
  async handleStartGame(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.user.sub;
    try {
      const room = await this.startGameUseCase.execute({
        hostId: userId,
        roomId: data.roomId,
      });

      this.server.to(data.roomId).emit('room:started', this.formatRoom(room));
    } catch (err: any) {
      this.logger.error(`Room start failed: ${err.message}`);
      client.emit('error', err.message);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('lobby:join_queue')
  async handleJoinQueue(@ConnectedSocket() client: Socket & { user: JwtPayload }) {
    const userId = client.user.sub;
    try {
      const room = await this.lobbyService.joinQueue(userId);
      if (room) {
        // Match found!
        this.server.to(room.id).emit('lobby:match_found', this.formatRoom(room));
      } else {
        client.emit('lobby:queue_joined');
      }
    } catch (err: any) {
      this.logger.error(`Lobby join queue failed: ${err.message}`);
      client.emit('error', err.message);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('lobby:leave_queue')
  async handleLeaveQueue(@ConnectedSocket() client: Socket & { user: JwtPayload }) {
    const userId = client.user.sub;
    try {
      await this.lobbyService.leaveQueue(userId);
      client.emit('lobby:queue_left');
    } catch (err: any) {
      this.logger.error(`Lobby leave queue failed: ${err.message}`);
      client.emit('error', err.message);
    }
  }

  private broadcastRoomUpdate(roomId: string, room: Room) {
    this.server.to(roomId).emit('room:updated', this.formatRoom(room));
  }

  private formatRoom(room: Room) {
    return {
      id: room.id,
      name: room.name,
      hostId: room.hostId,
      ruleset: room.ruleset,
      status: room.status,
      players: room.players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        avatar: p.avatar,
        elo: p.elo,
        isReady: p.isReady,
      })),
    };
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake?.auth as unknown;
    if (auth && typeof auth === 'object' && 'token' in auth) {
      const token = (auth as Record<string, unknown>).token;
      if (typeof token === 'string') return token;
    }

    const authorization = client.handshake?.headers?.authorization;
    if (
      typeof authorization === 'string' &&
      authorization.startsWith('Bearer ')
    ) {
      return authorization.slice(7);
    }

    return null;
  }
}
