import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';
import { MatchTicket } from '../../domain/entities/match-ticket.entity.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export interface RespondToMatchInput {
  userId: string;
  ticketId: string;
  accept: boolean;
}

export interface RespondToMatchResult {
  status: 'accepted' | 'declined' | 'completed' | 'cancelled';
  ticket?: MatchTicket;
  roomId?: string;
  requeuedPlayers?: string[];
  cancelledPlayer?: string;
}

export class RespondToMatchUseCase {
  constructor(
    private readonly matchmakingRepository: IMatchmakingRepository,
    private readonly createRoomUseCase: any,
    private readonly joinRoomUseCase: any,
    private readonly toggleReadyUseCase: any,
    private readonly startGameUseCase: any,
  ) {}

  async execute(input: RespondToMatchInput): Promise<RespondToMatchResult> {
    const ticket = await this.matchmakingRepository.getTicket(input.ticketId);
    if (!ticket) {
      throw new DomainException('MATCH_NOT_FOUND', 'Match ticket expired or not found');
    }

    if (!ticket.players.includes(input.userId)) {
      throw new DomainException('NOT_IN_MATCH', 'Player is not in this match ticket');
    }

    if (!input.accept) {
      // Player declined - Cancel ticket and requeue other players
      await this.matchmakingRepository.deleteTicket(input.ticketId);

      const requeued: string[] = [];
      for (const p of ticket.players) {
        if (p !== input.userId) {
          const originalJoinedAt = await this.matchmakingRepository.getJoinedAt(ticket.ruleset, p);
          await this.matchmakingRepository.addToQueue(ticket.ruleset, p, 1000, originalJoinedAt || new Date());
          requeued.push(p);
        }
      }

      return {
        status: 'cancelled',
        requeuedPlayers: requeued,
        cancelledPlayer: input.userId,
      };
    }

    // Player accepted - update ticket state
    if (ticket.acceptedPlayers.includes(input.userId)) {
      return { status: 'accepted', ticket };
    }

    const updatedAccepted = [...ticket.acceptedPlayers, input.userId];
    const updatedTicket = new MatchTicket(
      ticket.id,
      ticket.ruleset,
      ticket.players,
      updatedAccepted,
      ticket.createdAt
    );

    if (updatedTicket.isFullyAccepted()) {
      await this.matchmakingRepository.deleteTicket(ticket.id);

      // 1. Create Room (pick first player as host)
      const hostId = updatedTicket.players[0];
      const room = await this.createRoomUseCase.execute({
        hostId,
        name: `Matchmaking Room - ${ticket.id.slice(0, 8)}`,
        ruleset: ticket.ruleset,
      });

      // 2. Join the other 3 players
      for (let i = 1; i < updatedTicket.players.length; i++) {
        await this.joinRoomUseCase.execute({
          userId: updatedTicket.players[i],
          roomId: room.id,
        });
      }

      // 3. Mark all 3 non-host players as Ready
      for (let i = 1; i < updatedTicket.players.length; i++) {
        await this.toggleReadyUseCase.execute({
          userId: updatedTicket.players[i],
          roomId: room.id,
          isReady: true,
        });
      }

      // 4. Start the game
      await this.startGameUseCase.execute({
        hostId,
        roomId: room.id,
      });

      return {
        status: 'completed',
        roomId: room.id,
      };
    }

    await this.matchmakingRepository.saveTicket(updatedTicket);
    return {
      status: 'accepted',
      ticket: updatedTicket,
    };
  }
}
