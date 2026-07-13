import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { IUserRepository } from '../../domain/user.repository.js';
import { JwtTokenService } from '../../infrastructure/token/jwt-token.service.js';
import { SessionService } from '../../infrastructure/session/session.service.js';
import crypto from 'crypto';

@Injectable()
export class LoginUseCase {
  private readonly EXPIRED_DAYS: number = 7;

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly jwtTokenService: JwtTokenService,
    private readonly sessionService: SessionService,
  ) {}

  async execute(dto: { email: string; password: string }): Promise<{
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      displayName: string;
      elo: number;
      avatar: string | null;
    };
  }> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const isMatch = user.verifyPassword(dto.password);
    if (!isMatch) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException('EMAIL_NOT_VERIFIED');
    }

    const accessToken = await this.jwtTokenService.generateAccessToken({
      sub: user.id,
      email: user.email.getValue(),
    });

    const refreshToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.EXPIRED_DAYS);

    await this.sessionService.createSession(user.id, refreshToken, expiresAt);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email.getValue(),
        displayName: user.displayName,
        elo: user.elo,
        avatar: user.avatar,
      },
    };
  }
}
