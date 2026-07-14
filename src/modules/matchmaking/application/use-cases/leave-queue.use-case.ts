import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';

export interface LeaveQueueInput {
  userId: string;
  ruleset: 'riichi' | 'chinese';
}

export class LeaveQueueUseCase {
  constructor(private readonly matchmakingRepository: IMatchmakingRepository) {}

  async execute(input: LeaveQueueInput): Promise<void> {
    await this.matchmakingRepository.removeFromQueue(
      input.ruleset,
      input.userId,
    );
  }
}
