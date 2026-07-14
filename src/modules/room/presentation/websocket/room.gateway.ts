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
import { UseGuards, Logger, Inject, forwardRef } from '@nestjs/common';
import { WsAuthGuard } from '../../../../shared/websocket/ws-auth.guard.js';
import { CreateRoomUseCase } from '../../application/use-cases/create-room.use-case.js';
import { JoinRoomUseCase } from '../../application/use-cases/join-room.use-case.js';
import { LeaveRoomUseCase } from '../../application/use-cases/leave-room.use-case.js';
import { ToggleReadyUseCase } from '../../application/use-cases/toggle-ready.use-case.js';
import { StartGameUseCase } from '../../application/use-cases/start-game.use-case.js';
import { JwtPayload } from '../../../../shared/decorators/current-user.decorator.js';
import { Room } from '../../domain/entities/room.entity.js';
import { JwtTokenService } from '../../../auth/infrastructure/token/jwt-token.service.js';
import { IRoomRepository } from '../../domain/repositories/room.repository.js';
import { LobbyGateway } from '../../../lobby/presentation/websocket/lobby.gateway.js';

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
    private readonly createRoomUseCase: CreateRoomUseCase,
    private readonly joinRoomUseCase: JoinRoomUseCase,
    private readonly leaveRoomUseCase: LeaveRoomUseCase,
    private readonly toggleReadyUseCase: ToggleReadyUseCase,
    private readonly startGameUseCase: StartGameUseCase,
    private readonly roomRepository: IRoomRepository,
    @Inject(forwardRef(() => LobbyGateway))
    private readonly lobbyGateway?: LobbyGateway,
    private readonly jwtTokenService?: JwtTokenService, // Optional to avoid breaking unit tests
  ) {}

  private getErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected to /room: ${client.id}`);
    if (this.jwtTokenService) {
      const token = this.extractToken(client);
      if (token) {
        try {
          const payload = await this.jwtTokenService.verifyAccessToken(token);
          const clientWithUser = client as Socket & { user?: JwtPayload };
          clientWithUser.user = payload;
          this.logger.log(`User ${payload.sub} authenticated in /room`);
        } catch {
          // Ignored
        }
      }
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from /room: ${client.id}`);
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
    } catch (err) {
      const msg = this.getErrorMessage(err);
      this.logger.error(`Room creation failed: ${msg}`);
      client.emit('error', msg);
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
    } catch (err) {
      const msg = this.getErrorMessage(err);
      this.logger.error(`Room join failed: ${msg}`);
      client.emit('error', msg);
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
      const room = await this.roomRepository.findById(data.roomId);
      const ruleset = room?.ruleset;

      const result = await this.leaveRoomUseCase.execute({
        userId,
        roomId: data.roomId,
      });

      await client.leave(data.roomId);
      if (!result.closed) {
        const updatedRoom = await this.roomRepository.findById(data.roomId);
        if (updatedRoom) {
          this.broadcastRoomUpdate(data.roomId, updatedRoom);
        }
      } else {
        // Room was deleted because it is empty
        this.server
          .to(data.roomId)
          .emit('room:deleted', { roomId: data.roomId });
        if (ruleset && this.lobbyGateway) {
          this.lobbyGateway.broadcastRooms(ruleset).catch((err) => {
            this.logger.error(`Failed to broadcast rooms on delete: ${err.message}`);
          });
        }
      }
    } catch (err) {
      const msg = this.getErrorMessage(err);
      this.logger.error(`Room leave failed: ${msg}`);
      client.emit('error', msg);
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
    } catch (err) {
      const msg = this.getErrorMessage(err);
      this.logger.error(`Room ready toggle failed: ${msg}`);
      client.emit('error', msg);
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
      if (this.lobbyGateway) {
        this.lobbyGateway.broadcastRooms(room.ruleset).catch((err) => {
          this.logger.error(`Failed to broadcast rooms on start: ${err.message}`);
        });
      }
    } catch (err) {
      const msg = this.getErrorMessage(err);
      this.logger.error(`Room start failed: ${msg}`);
      client.emit('error', msg);
    }
  }



  private broadcastRoomUpdate(roomId: string, room: Room) {
    this.server.to(roomId).emit('room:updated', this.formatRoom(room));
    if (this.lobbyGateway) {
      this.lobbyGateway.broadcastRooms(room.ruleset).catch((err) => {
        this.logger.error(`Failed to broadcast rooms update: ${err.message}`);
      });
    }
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
