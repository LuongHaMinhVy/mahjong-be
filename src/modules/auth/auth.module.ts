import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './presentation/controllers/auth.controller.js';
import { RegisterUseCase } from './application/use-cases/register.use-case.js';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case.js';
import { LoginUseCase } from './application/use-cases/login.use-case.js';
import { RefreshUseCase } from './application/use-cases/refresh.use-case.js';
import { LogoutUseCase } from './application/use-cases/logout.use-case.js';
import { IUserRepository } from './domain/user.repository.js';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository.js';
import { JwtTokenService } from './infrastructure/token/jwt-token.service.js';
import { RedisOtpService } from './infrastructure/otp/redis-otp.service.js';
import { ResendEmailService } from './infrastructure/email/resend-email.service.js';
import { SessionService } from './infrastructure/session/session.service.js';
import { PrismaModule } from '../../shared/database/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('JWT_SECRET') ?? 'fallback-jwt-secret-key-for-dev',
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    RegisterUseCase,
    VerifyEmailUseCase,
    LoginUseCase,
    RefreshUseCase,
    LogoutUseCase,
    JwtTokenService,
    RedisOtpService,
    ResendEmailService,
    SessionService,
    {
      provide: IUserRepository,
      useClass: PrismaUserRepository,
    },
  ],
  exports: [JwtTokenService, IUserRepository],
})
export class AuthModule {}
