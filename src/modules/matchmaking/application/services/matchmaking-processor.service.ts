import { Injectable, Logger } from '@nestjs/common';
import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';
import { MatchTicket } from '../../domain/entities/match-ticket.entity.js';
import { randomUUID } from 'crypto';

export interface IMatchmakingLobbyGateway {
  broadcastMatchFound(ticketId: string, playerIds: string[]): void;
}

@Injectable()
export class MatchmakingProcessor {
  private readonly logger = new Logger(MatchmakingProcessor.name);
  private intervalId?: NodeJS.Timeout;

  constructor(
    private readonly matchmakingRepository: IMatchmakingRepository,
    private readonly lobbyGateway: IMatchmakingLobbyGateway,
  ) {}

  start() {
    this.intervalId = setInterval(() => {
      this.processMatchmaking().catch((err) =>
        this.logger.error(`Error in matchmaking loop: ${(err as Error).message}`),
      );
    }, 2000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  async processMatchmaking() {
    await Promise.all([this.matchQueue('riichi'), this.matchQueue('chinese')]);
  }

  async matchQueue(ruleset: 'riichi' | 'chinese') {
    const queue = await this.matchmakingRepository.getQueue(ruleset);
    if (queue.length < 4) return;

    // Prioritize players waiting the longest
    const sorted = [...queue].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    const matchedGroup: string[] = [];

    const now = new Date();

    for (let i = 0; i < sorted.length; i++) {
      const pA = sorted[i];
      const candidates = [pA];

      for (let j = 0; j < sorted.length; j++) {
        if (i === j) continue;
        const pB = sorted[j];

        // Check if pB is within allowed ELO gap of pA, and vice-versa
        const gapA = pA.getAllowedEloGap(now);
        const gapB = pB.getAllowedEloGap(now);

        const eloDiff = Math.abs(pA.elo - pB.elo);
        if (eloDiff <= gapA && eloDiff <= gapB) {
          candidates.push(pB);
        }

        if (candidates.length === 4) {
          break;
        }
      }

      if (candidates.length === 4) {
        matchedGroup.push(...candidates.map((c) => c.userId));
        break;
      }
    }

    if (matchedGroup.length === 4) {
      const ticketId = randomUUID();
      const ticket = new MatchTicket(ticketId, ruleset, matchedGroup, [], new Date());

      // Remove from queue
      await Promise.all(matchedGroup.map((userId) => this.matchmakingRepository.removeFromQueue(ruleset, userId)));

      // Create ticket
      await this.matchmakingRepository.createTicket(ticket);

      // Broadcast event
      this.lobbyGateway.broadcastMatchFound(ticketId, matchedGroup);
      this.logger.log(`Match ticket created: ${ticketId} for players ${matchedGroup.join(', ')}`);
    }
  }
}
