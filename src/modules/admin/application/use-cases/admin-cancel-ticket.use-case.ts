import { type IMatchmakingRepository } from '../../../matchmaking/domain/repositories/matchmaking.repository.js';
import { NotFoundException } from '../../../../shared/exceptions/domain.exception.js';

export interface AdminCancelTicketInput {
  ticketId: string;
}

export class AdminCancelTicketUseCase {
  constructor(private readonly matchmakingRepository: IMatchmakingRepository) {}

  async execute(input: AdminCancelTicketInput): Promise<void> {
    const ticket = await this.matchmakingRepository.getTicket(input.ticketId);
    if (!ticket) {
      throw new NotFoundException('MatchmakingTicket', input.ticketId);
    }
    await this.matchmakingRepository.deleteTicket(input.ticketId);
  }
}
