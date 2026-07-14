import {
  Module,
  type NestModule,
  type MiddlewareConsumer,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './shared/database/prisma.module.js';
import { RedisModule } from './shared/redis/redis.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { MahjongModule } from './modules/mahjong/mahjong.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { RoomModule } from './modules/room/room.module.js';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module.js';
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module.js';
import { LobbyModule } from './modules/lobby/lobby.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { I18nModule } from './shared/i18n/i18n.module.js';
import { I18nMiddleware } from './shared/i18n/i18n.middleware.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    I18nModule,
    AuthModule,
    MahjongModule,
    UsersModule,
    RoomModule,
    LeaderboardModule,
    MatchmakingModule,
    LobbyModule,
    AdminModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(I18nMiddleware).forRoutes('*');
  }
}
