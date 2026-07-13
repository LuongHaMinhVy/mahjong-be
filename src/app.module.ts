import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './shared/database/prisma.module.js';
import { RedisModule } from './shared/redis/redis.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { MahjongModule } from './modules/mahjong/mahjong.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { RoomModule } from './modules/room/room.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    AuthModule,
    MahjongModule,
    UsersModule,
    RoomModule,
  ],
})
export class AppModule {}
