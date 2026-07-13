import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtPayload } from '../decorators/current-user.decorator';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket & { user?: JwtPayload } = context
      .switchToWs()
      .getClient();
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException('Missing authentication token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      client.user = payload;
      return true;
    } catch {
      this.logger.warn(`WS auth failed for client ${client.id}`);
      throw new WsException('Invalid authentication token');
    }
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake?.auth?.token;
    if (typeof auth === 'string') return auth;

    const header = client.handshake?.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }

    return null;
  }
}
