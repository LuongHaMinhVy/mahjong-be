import { type MatchmakingQueueEntry } from '../value-objects/queue-entry.vo.js';
import { type MatchTicket } from '../entities/match-ticket.entity.js';

export abstract class IMatchmakingRepository {
  abstract addToQueue(
    ruleset: 'riichi' | 'chinese',
    userId: string,
    elo: number,
    joinedAt: Date,
  ): Promise<void>;
  abstract removeFromQueue(
    ruleset: 'riichi' | 'chinese',
    userId: string,
  ): Promise<void>;
  abstract getQueue(
    ruleset: 'riichi' | 'chinese',
  ): Promise<MatchmakingQueueEntry[]>;
  abstract getJoinedAt(
    ruleset: 'riichi' | 'chinese',
    userId: string,
  ): Promise<Date | null>;

  abstract createTicket(ticket: MatchTicket): Promise<void>;
  abstract getTicket(ticketId: string): Promise<MatchTicket | null>;
  abstract saveTicket(ticket: MatchTicket): Promise<void>;
  abstract deleteTicket(ticketId: string): Promise<void>;
}
