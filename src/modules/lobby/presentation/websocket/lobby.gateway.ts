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
import { UseGuards, Logger } from '@nestjs/common';
import { WsAuthGuard } from '../../../../shared/websocket/ws-auth.guard.js';
import { LobbyService } from '../../application/services/lobby.service.js';
import { JwtPayload } from '../../../../shared/decorators/current-user.decorator.js';
import { JwtTokenService } from '../../../auth/infrastructure/token/jwt-token.service.js';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/lobby',
})
export class LobbyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LobbyGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly lobbyService: LobbyService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected to /lobby: ${client.id}`);
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Disconnecting client ${client.id} - missing token`);
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwtTokenService.verifyAccessToken(token);
      const clientWithUser = client as Socket & { user?: JwtPayload };
      clientWithUser.user = payload;
      await this.lobbyService.setUserOnline(payload.sub);
      this.logger.log(
        `User ${payload.sub} marked online via /lobby connection`,
      );
    } catch (err) {
      this.logger.warn(`Disconnecting client ${client.id} - invalid token`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from /lobby: ${client.id}`);
    const clientWithUser = client as Socket & { user?: JwtPayload };
    const userId = clientWithUser.user?.sub;
    if (userId) {
      await this.lobbyService.setUserOffline(userId);
      this.logger.log(`User ${userId} marked offline via /lobby disconnect`);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('lobby:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { ruleset: 'riichi' | 'chinese' },
  ) {
    const roomName = `lobby:ruleset:${data.ruleset}`;
    await client.join(roomName);
    this.logger.log(
      `User ${client.user.sub} subscribed to ruleset ${data.ruleset}`,
    );

    const rooms = await this.lobbyService.getRoomsByRuleset(data.ruleset);
    client.emit('lobby:rooms', this.formatRooms(rooms));
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('lobby:unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { ruleset: 'riichi' | 'chinese' },
  ) {
    const roomName = `lobby:ruleset:${data.ruleset}`;
    await client.leave(roomName);
    this.logger.log(
      `User ${client.user.sub} unsubscribed from ruleset ${data.ruleset}`,
    );
  }

  async broadcastRooms(ruleset: 'riichi' | 'chinese') {
    const rooms = await this.lobbyService.getRoomsByRuleset(ruleset);
    this.server
      .to(`lobby:ruleset:${ruleset}`)
      .emit('lobby:rooms', this.formatRooms(rooms));
    this.logger.log(`Broadcasted rooms list update for ruleset ${ruleset}`);
  }

  private formatRooms(rooms: any[]) {
    return rooms.map((r) => ({
      id: r.id,
      name: r.name,
      hostId: r.hostId,
      ruleset: r.ruleset,
      status: r.status,
      playersCount: r.players.length,
    }));
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
