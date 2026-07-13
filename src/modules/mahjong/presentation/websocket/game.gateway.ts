import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { WsAuthGuard } from '../../../../shared/websocket/ws-auth.guard.js';
import { StartGameUseCase } from '../../application/use-cases/start-game.use-case.js';
import { DrawTileUseCase } from '../../application/use-cases/draw-tile.use-case.js';
import { DiscardTileUseCase } from '../../application/use-cases/discard-tile.use-case.js';
import { ClaimMeldUseCase } from '../../application/use-cases/claim-meld.use-case.js';
import { DeclareWinUseCase } from '../../application/use-cases/declare-win.use-case.js';
import { IGameStateRepository } from '../../domain/repositories/game-state.repository.js';
import { JwtPayload } from '../../../../shared/decorators/current-user.decorator.js';
import { GameState } from '../../domain/entities/game-state.entity.js';
import { Tile } from '../../domain/value-objects/tile.vo.js';
import { MeldType } from '../../domain/value-objects/meld.vo.js';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly startGameUseCase: StartGameUseCase,
    private readonly drawTileUseCase: DrawTileUseCase,
    private readonly discardTileUseCase: DiscardTileUseCase,
    private readonly claimMeldUseCase: ClaimMeldUseCase,
    private readonly declareWinUseCase: DeclareWinUseCase,
    private readonly gameStateRepository: IGameStateRepository,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('game:join')
  async handleJoinGame(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { gameId: string },
  ) {
    const userId = client.user.sub;
    const gameId = data.gameId;

    await client.join(gameId);
    this.logger.log(`User ${userId} joined room ${gameId}`);

    const state = await this.gameStateRepository.findById(gameId);
    if (!state) {
      client.emit('error', 'Game not found');
      return;
    }

    const formatted = this.formatGameStateForPlayer(state, userId);
    client.emit('game:state', formatted);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('game:start')
  async handleStartGame(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { roomId: string; ruleset: 'riichi' | 'chinese'; playerIds: string[] },
  ) {
    const userId = client.user.sub;
    this.logger.log(`User ${userId} requested starting game for room ${data.roomId}`);

    try {
      const state = await this.startGameUseCase.execute({
        roomId: data.roomId,
        rulesetName: data.ruleset,
        playerIds: data.playerIds,
      });
      await client.join(state.id);
      await this.broadcastGameState(state.id, state);
    } catch (err: any) {
      this.logger.error(`Failed to start game: ${err.message}`);
      client.emit('error', err.message);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('game:draw')
  async handleDrawTile(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { gameId: string },
  ) {
    const userId = client.user.sub;
    try {
      await this.drawTileUseCase.execute({
        gameId: data.gameId,
      });
      const state = await this.gameStateRepository.findById(data.gameId);
      if (!state) {
        throw new Error('Game state not found after drawing tile');
      }
      await this.broadcastGameState(data.gameId, state);
    } catch (err: any) {
      this.logger.error(`Draw tile failed: ${err.message}`);
      client.emit('error', err.message);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('game:discard')
  async handleDiscardTile(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { gameId: string; tileId: string },
  ) {
    const userId = client.user.sub;
    try {
      await this.discardTileUseCase.execute({
        gameId: data.gameId,
        playerId: userId,
        tileId: data.tileId,
      });
      const state = await this.gameStateRepository.findById(data.gameId);
      if (!state) {
        throw new Error('Game state not found after discarding tile');
      }
      await this.broadcastGameState(data.gameId, state);
    } catch (err: any) {
      this.logger.error(`Discard tile failed: ${err.message}`);
      client.emit('error', err.message);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('game:claim')
  async handleClaimMeld(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: {
      gameId: string;
      meldType: MeldType;
      claimedTile: { suit: string; value: number; type: string; id: string };
      handTilesToUse: Array<{ suit: string; value: number; type: string; id: string }>;
    },
  ) {
    const userId = client.user.sub;
    try {
      const claimedTile = Tile.create(
        data.claimedTile.suit as any,
        data.claimedTile.value,
        data.claimedTile.type as any,
        data.claimedTile.id,
      );
      const handTilesToUse = data.handTilesToUse.map((t) =>
        Tile.create(t.suit as any, t.value, t.type as any, t.id),
      );

      await this.claimMeldUseCase.execute({
        gameId: data.gameId,
        playerId: userId,
        meldType: data.meldType,
        claimedTile,
        handTilesToUse,
      });
      const state = await this.gameStateRepository.findById(data.gameId);
      if (!state) {
        throw new Error('Game state not found after claiming meld');
      }
      await this.broadcastGameState(data.gameId, state);
    } catch (err: any) {
      this.logger.error(`Claim meld failed: ${err.message}`);
      client.emit('error', err.message);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('game:win')
  async handleDeclareWin(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: {
      gameId: string;
      isSelfDraw: boolean;
      discarderId?: string;
    },
  ) {
    const userId = client.user.sub;
    try {
      const scoreResult = await this.declareWinUseCase.execute({
        gameId: data.gameId,
        playerId: userId,
        isSelfDraw: data.isSelfDraw,
        discarderId: data.discarderId,
      });
      this.server.to(data.gameId).emit('game:finished', scoreResult);
    } catch (err: any) {
      this.logger.error(`Declare win failed: ${err.message}`);
      client.emit('error', err.message);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('game:skip')
  async handleSkip(
    @ConnectedSocket() client: Socket & { user: JwtPayload },
    @MessageBody() data: { gameId: string },
  ) {
    const userId = client.user.sub;
    try {
      this.logger.log(`User ${userId} requested skip for game ${data.gameId}`);
      const state = await this.gameStateRepository.findById(data.gameId);
      if (state) {
        const formatted = this.formatGameStateForPlayer(state, userId);
        client.emit('game:state', formatted);
      }
    } catch (err: any) {
      this.logger.error(`Skip failed: ${err.message}`);
      client.emit('error', err.message);
    }
  }

  private async broadcastGameState(gameId: string, state: GameState) {
    const sockets = await this.server.in(gameId).fetchSockets();
    for (const socket of sockets) {
      const client = socket as unknown as Socket & { user?: JwtPayload };
      const userId = client.user?.sub;
      if (userId) {
        const formattedState = this.formatGameStateForPlayer(state, userId);
        client.emit('game:state', formattedState);
      } else {
        client.emit('game:state', this.formatGameStateForPlayer(state, ''));
      }
    }
  }

  private formatGameStateForPlayer(state: GameState, userId: string) {
    return {
      id: state.id,
      roomId: state.roomId,
      rulesetName: state.rulesetName,
      phase: state.phase,
      wallCount: state.wall.length,
      currentTurn: state.currentTurn,
      round: state.round,
      honba: state.honba,
      dora: state.dora,
      discardPile: state.discardPile,
      players: state.players.map((p) => {
        const isSelf = p.userId === userId;
        return {
          userId: p.userId,
          score: p.score,
          isRiichi: p.isRiichi,
          melds: p.melds,
          discards: p.discards,
          hand: isSelf ? p.hand : [],
          handSize: p.hand.length,
        };
      }),
    };
  }
}
