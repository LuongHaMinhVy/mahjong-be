/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import {
  GameState,
  PlayerState,
} from '../../domain/entities/game-state.entity.js';
import { IGameStateRepository } from '../../domain/repositories/game-state.repository.js';
import { Tile } from '../../domain/value-objects/tile.vo.js';
import { Meld } from '../../domain/value-objects/meld.vo.js';

@Injectable()
export class RedisGameStateRepository implements IGameStateRepository {
  private readonly ttl = 86400; // 24 hours in seconds
  private readonly prefix = 'mahjong:game:';

  constructor(@Inject('REDIS') private readonly redis: Redis) {}

  async save(gameState: GameState): Promise<void> {
    const key = `${this.prefix}${gameState.id}`;
    const data = JSON.stringify(gameState);
    await this.redis.setex(key, this.ttl, data);
  }

  async findById(id: string): Promise<GameState | null> {
    const key = `${this.prefix}${id}`;
    const data = await this.redis.get(key);
    if (!data) return null;

    try {
      const raw = JSON.parse(data);
      return this.reconstructGameState(raw);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    const key = `${this.prefix}${id}`;
    await this.redis.del(key);
  }

  private reconstructTile(raw: any): Tile {
    return Tile.create(raw.suit, raw.value, raw.type, raw.id);
  }

  private reconstructMeld(raw: any): Meld {
    return new Meld(
      raw.type,
      raw.tiles.map((t: any) => this.reconstructTile(t)),
      raw.isConcealed,
    );
  }

  private reconstructPlayerState(raw: any): PlayerState {
    return {
      userId: raw.userId,
      hand: raw.hand.map((t: any) => this.reconstructTile(t)),
      melds: raw.melds.map((m: any) => this.reconstructMeld(m)),
      discards: raw.discards.map((t: any) => this.reconstructTile(t)),
      score: raw.score,
      isRiichi: raw.isRiichi,
    };
  }

  private reconstructGameState(raw: any): GameState {
    return new GameState(
      raw.id,
      raw.roomId,
      raw.rulesetName,
      raw.phase,
      raw.wall.map((t: any) => this.reconstructTile(t)),
      raw.currentTurn,
      raw.players.map((p: any) => this.reconstructPlayerState(p)),
      raw.round,
      raw.honba,
      raw.dora ? raw.dora.map((t: any) => this.reconstructTile(t)) : [],
      raw.discardPile
        ? raw.discardPile.map((pile: any[]) =>
            pile.map((t: any) => this.reconstructTile(t)),
          )
        : [[], [], [], []],
    );
  }
}
