import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';
import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { NotFoundException } from '../../../../shared/exceptions/domain.exception.js';

export interface JoinQueueInput {
  userId: string;
  ruleset: 'riichi' | 'chinese';
}

export class JoinQueueUseCase {
  constructor(
    private readonly matchmakingRepository: IMatchmakingRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: JoinQueueInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundException('User', input.userId);
    }
    await this.matchmakingRepository.addToQueue(input.ruleset, user.id, user.elo, new Date());
  }
}
