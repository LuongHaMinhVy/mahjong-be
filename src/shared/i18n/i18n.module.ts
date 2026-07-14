import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { I18nService } from './i18n.service.js';
import { PrismaModule } from '../database/prisma.module.js';

@Global()
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
  providers: [I18nService],
  exports: [I18nService],
})
export class I18nModule {}
