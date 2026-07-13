import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import {
  IGoogleAuthService,
  type GoogleUserPayload,
} from '../../domain/google-auth.service.js';

@Injectable()
export class GoogleAuthService implements IGoogleAuthService {
  private readonly client: OAuth2Client;

  constructor(private readonly configService: ConfigService) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.client = new OAuth2Client({ clientId });
  }

  async verifyToken(idToken: string): Promise<GoogleUserPayload> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.name) {
        throw new UnauthorizedException('GOOGLE_TOKEN_INVALID');
      }

      return {
        email: payload.email,
        displayName: payload.name,
        avatar: payload.picture ?? null,
      };
    } catch {
      throw new UnauthorizedException('GOOGLE_TOKEN_INVALID');
    }
  }
}
