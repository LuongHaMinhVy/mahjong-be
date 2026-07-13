import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import {
  GameResult,
  GameResultPlayer,
} from '../../domain/entities/game-result.entity.js';
import { IGameResultRepository } from '../../domain/repositories/game-result.repository.js';

@Injectable()
export class PrismaGameResultRepository implements IGameResultRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(gameResult: GameResult): Promise<void> {
    await this.prisma.gameResult.create({
      data: {
        id: gameResult.id,
        roomId: gameResult.roomId,
        rulesetName: gameResult.rulesetName,
        winnerId: gameResult.winnerId,
        playersJson: JSON.parse(JSON.stringify(gameResult.players)),
        createdAt: gameResult.createdAt,
      },
    });
  }

  async findById(id: string): Promise<GameResult | null> {
    const raw = await this.prisma.gameResult.findUnique({
      where: { id },
    });
    if (!raw) return null;

    return this.mapToDomain(raw);
  }

  async findByPlayerId(playerId: string): Promise<GameResult[]> {
    // Find all game results where the playersJson array contains the player's userId
    // In PostgreSQL with Prisma, we can search within JSONB using path operations
    // or we can fetch and filter, or use Prisma's json filters:
    // path: 'playersJson', array_contains: [{ userId: playerId }]
    const results = await this.prisma.gameResult.findMany({
      where: {
        playersJson: {
          path: [],
          array_contains: [{ userId: playerId }],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return results.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(raw: any): GameResult {
    const players = raw.playersJson as GameResultPlayer[];
    return new GameResult(
      raw.id,
      raw.roomId,
      raw.rulesetName as 'riichi' | 'chinese',
      raw.winnerId,
      players,
      raw.createdAt,
    );
  }
}
