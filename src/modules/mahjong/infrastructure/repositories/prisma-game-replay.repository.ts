import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import {
  IGameReplayRepository,
  type GameReplay,
} from '../../domain/repositories/game-replay.repository.js';
import { type GameAction } from '../../domain/value-objects/game-action.vo.js';

@Injectable()
export class PrismaGameReplayRepository implements IGameReplayRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(gameResultId: string, actions: GameAction[]): Promise<GameReplay> {
    const record = await this.prisma.gameReplay.create({
      data: {
        gameResultId,
        actionsJson: JSON.parse(JSON.stringify(actions)),
      },
    });

    return {
      id: record.id,
      gameResultId: record.gameResultId,
      actions: record.actionsJson as unknown as GameAction[],
      createdAt: record.createdAt,
    };
  }

  async findByGameResultId(gameResultId: string): Promise<GameReplay | null> {
    const record = await this.prisma.gameReplay.findUnique({
      where: { gameResultId },
    });

    if (!record) return null;

    return {
      id: record.id,
      gameResultId: record.gameResultId,
      actions: record.actionsJson as unknown as GameAction[],
      createdAt: record.createdAt,
    };
  }
}
