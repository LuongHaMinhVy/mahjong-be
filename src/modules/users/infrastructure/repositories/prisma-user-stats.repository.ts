import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { IUserStatsRepository } from '../../domain/repositories/user-stats.repository.js';
import { UserStats } from '../../domain/value-objects/user-stats.vo.js';
import { GameResult, GameResultPlayer } from '../../../mahjong/domain/entities/game-result.entity.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

@Injectable()
export class PrismaUserStatsRepository implements IUserStatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(userId: string): Promise<UserStats> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new DomainException('NOT_FOUND', 'User not found');
    }

    // Get all game results where the playersJson array contains the player's userId
    const results = await this.prisma.gameResult.findMany({
      where: {
        playersJson: {
          path: [],
          array_contains: [{ userId }],
        },
      },
    });

    const totalGames = results.length;
    const wins = results.filter((r) => r.winnerId === userId).length;
    const winRate = totalGames > 0 ? wins / totalGames : 0;

    return {
      totalGames,
      wins,
      winRate,
      currentElo: user.elo,
    };
  }

  async getMatchHistory(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<GameResult[]> {
    const rawResults = await this.prisma.gameResult.findMany({
      where: {
        playersJson: {
          path: [],
          array_contains: [{ userId }],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return rawResults.map((r) => this.mapToDomain(r));
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
