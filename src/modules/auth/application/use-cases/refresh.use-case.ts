import { Injectable, UnauthorizedException } from '@nestjs/common';
import { IUserRepository } from '../../domain/user.repository.js';
import { JwtTokenService } from '../../infrastructure/token/jwt-token.service.js';
import { SessionService } from '../../infrastructure/session/session.service.js';
import crypto from 'crypto';

@Injectable()
export class RefreshUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly jwtTokenService: JwtTokenService,
    private readonly sessionService: SessionService,
  ) {}

  async execute(
    oldRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const userId = await this.sessionService.validateSession(oldRefreshToken);
    if (!userId) {
      throw new UnauthorizedException('REFRESH_TOKEN_INVALID');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('REFRESH_TOKEN_INVALID');
    }

    // Revoke old session immediately (rotation)
    await this.sessionService.revokeSession(oldRefreshToken);

    const accessToken = await this.jwtTokenService.generateAccessToken({
      sub: user.id,
      email: user.email.getValue(),
    });

    const newRefreshToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.sessionService.createSession(
      user.id,
      newRefreshToken,
      expiresAt,
    );

    return { accessToken, refreshToken: newRefreshToken };
  }
}
