import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RoomModule } from '../room/room.module.js';
import { LobbyService } from './application/services/lobby.service.js';
import { LobbyGateway } from './presentation/websocket/lobby.gateway.js';

@Module({
  imports: [AuthModule, forwardRef(() => RoomModule)],
  providers: [LobbyService, LobbyGateway],
  exports: [LobbyService, LobbyGateway],
})
export class LobbyModule {}
