import { Injectable } from '@nestjs/common';
import { RiichiRuleset } from '../../domain/services/riichi.ruleset.js';
import { ChineseRuleset } from '../../domain/services/chinese.ruleset.js';
import { IGameStateRepository } from '../../domain/repositories/game-state.repository.js';
import { IGameResultRepository } from '../../domain/repositories/game-result.repository.js';
import { IUserRepository } from '../../../auth/domain/user.repository.js';
import { User } from '../../../auth/domain/user.entity.js';
import { IGameReplayRepository } from '../../domain/repositories/game-replay.repository.js';
import {
  GameResult,
  type GameResultPlayer,
} from '../../domain/entities/game-result.entity.js';
import { Tile } from '../../domain/value-objects/tile.vo.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export interface DeclareWinDto {
  gameId: string;
  playerId: string;
  isSelfDraw: boolean;
  discarderId?: string;
}

@Injectable()
export class DeclareWinUseCase {
  constructor(
    private readonly gameStateRepository: IGameStateRepository,
    private readonly gameResultRepository: IGameResultRepository,
    private readonly userRepository: IUserRepository,
    private readonly gameReplayRepository: IGameReplayRepository,
  ) {}

  async execute(dto: DeclareWinDto): Promise<GameResult> {
    const state = await this.gameStateRepository.findById(dto.gameId);
    if (!state) {
      throw new DomainException('NOT_FOUND', 'Game not found.');
    }

    const player = state.players.find((p) => p.userId === dto.playerId);
    if (!player) {
      throw new DomainException('NOT_FOUND', 'Player not found in this game.');
    }

    const ruleset =
      state.rulesetName === 'riichi'
        ? new RiichiRuleset()
        : new ChineseRuleset();

    let winningTile: Tile | null = null;
    let discarderId = dto.discarderId;

    if (!dto.isSelfDraw) {
      if (!discarderId) {
        // If not explicitly provided, find the player whose turn just ended
        const prevTurnIdx = (state.currentTurn - 1 + 4) % 4;
        discarderId = state.players[prevTurnIdx].userId;
      }

      const discarder = state.players.find((p) => p.userId === discarderId);
      if (discarder && discarder.discards.length > 0) {
        winningTile = discarder.discards[discarder.discards.length - 1];
      }
    }

    const winResult = ruleset.canWin(player.hand, winningTile);
    if (!winResult || !winResult.isWin) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Hand does not meet winning conditions.',
      );
    }

    // Calculate score
    const playerIds = state.players.map((p) => p.userId);
    const scoreResult = ruleset.calculateScore(
      winResult,
      dto.playerId,
      playerIds,
      {
        round: state.round,
        honba: state.honba,
        dora: state.dora,
        isWinnerDealer: state.currentTurn === 0,
        isSelfDraw: dto.isSelfDraw,
        discarderId,
        riichiPlayers: state.players
          .filter((p) => p.isRiichi)
          .map((p) => p.userId),
      },
    );

    // Mutate state with final score changes and set phase to finished
    for (const p of state.players) {
      p.score += scoreResult.scoreMap[p.userId] || 0;
    }
    state.phase = 'finished';

    // If win tile is Ron, add the winning tile to player's hand representation
    if (!dto.isSelfDraw && winningTile) {
      player.hand.push(winningTile);
    }

    const winActionType = dto.isSelfDraw ? 'tsumo' : 'ron';
    state.addAction(dto.playerId, winActionType, winningTile || undefined, {
      scoreResult,
    });

    // Load users to fetch current ELO and display name
    const userMap = new Map<
      string,
      { displayName: string; elo: number; user: User | null }
    >();
    for (const p of state.players) {
      const user = await this.userRepository.findById(p.userId);
      if (user) {
        userMap.set(p.userId, {
          displayName: user.displayName,
          elo: user.elo,
          user,
        });
      } else {
        userMap.set(p.userId, {
          displayName: p.userId,
          elo: 1000,
          user: null,
        });
      }
    }

    // Calculate ELO Changes
    const eloPlayers = state.players.map((p) => ({
      userId: p.userId,
      score: p.score,
      currentElo: userMap.get(p.userId)?.elo ?? 1000,
    }));
    const eloChanges = this.calculateEloChanges(eloPlayers);

    // Save users with updated ELO
    for (const p of state.players) {
      const uData = userMap.get(p.userId);
      if (uData && uData.user) {
        const newElo = Math.max(
          100,
          uData.user.elo + (eloChanges[p.userId] || 0),
        );
        uData.user.updateElo(newElo);
        await this.userRepository.save(uData.user);
      }
    }

    // Save Game Result
    const gameResultPlayers: GameResultPlayer[] = state.players.map((p) => {
      const uData = userMap.get(p.userId);
      const displayName = uData ? uData.displayName : p.userId;
      return {
        userId: p.userId,
        displayName,
        score: p.score,
        pointChange: scoreResult.scoreMap[p.userId] || 0,
        isWinner: p.userId === dto.playerId,
      };
    });

    const resultId = `res-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const gameResult = new GameResult(
      resultId,
      state.roomId,
      state.rulesetName,
      dto.playerId,
      gameResultPlayers,
      new Date(),
    );

    await this.gameResultRepository.save(gameResult);
    await this.gameReplayRepository.save(resultId, state.actions);
    await this.gameStateRepository.delete(dto.gameId);

    return gameResult;
  }

  private calculateEloChanges(
    players: { userId: string; score: number; currentElo: number }[],
    kFactor = 32,
  ): Record<string, number> {
    const eloChanges: Record<string, number> = {};
    for (const p of players) {
      eloChanges[p.userId] = 0;
    }

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const pA = players[i];
        const pB = players[j];

        const rA = pA.currentElo;
        const rB = pB.currentElo;
        const eA = 1 / (1 + Math.pow(10, (rB - rA) / 400));

        let sA = 0.5;
        if (pA.score > pB.score) {
          sA = 1;
        } else if (pA.score < pB.score) {
          sA = 0;
        }
        const sB = 1 - sA;

        const changeA = kFactor * (sA - eA);
        const changeB = kFactor * (sB - (1 - eA));

        eloChanges[pA.userId] += changeA;
        eloChanges[pB.userId] += changeB;
      }
    }

    for (const key in eloChanges) {
      eloChanges[key] = Math.round(eloChanges[key]);
    }

    return eloChanges;
  }
}
