import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { IGoogleAuthService } from '../../domain/google-auth.service.js';
import { IUserRepository } from '../../domain/user.repository.js';
import { User } from '../../domain/user.entity.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { Password } from '../../domain/value-objects/password.vo.js';
import { JwtTokenService } from '../../infrastructure/token/jwt-token.service.js';
import { SessionService } from '../../infrastructure/session/session.service.js';

@Injectable()
export class GoogleLoginUseCase {
  private readonly EXPIRED_DAYS = 7;

  constructor(
    private readonly googleAuthService: IGoogleAuthService,
    private readonly userRepository: IUserRepository,
    private readonly jwtTokenService: JwtTokenService,
    private readonly sessionService: SessionService,
  ) {}

  async execute(idToken: string): Promise<{
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
    const googleUser = await this.googleAuthService.verifyToken(idToken);

    let user = await this.userRepository.findByEmail(googleUser.email);

    if (user) {
      if (!user.isEmailVerified) {
        user.verifyEmail();
        await this.userRepository.save(user);
      }
    } else {
      // Auto-generate strong secure random password
      const randomPassword = randomBytes(32).toString('hex');
      const password = Password.create(randomPassword);
      const email = new Email(googleUser.email);

      user = new User({
        email,
        password,
        displayName: googleUser.displayName,
        avatar: googleUser.avatar,
        isEmailVerified: true,
      });

      await this.userRepository.save(user);
    }

    const accessToken = await this.jwtTokenService.generateAccessToken({
      sub: user.id,
      email: user.email.getValue(),
    });

    const refreshToken = randomUUID();
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
