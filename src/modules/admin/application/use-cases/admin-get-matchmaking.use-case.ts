import { type IMatchmakingRepository } from '../../../matchmaking/domain/repositories/matchmaking.repository.js';
import { type MatchmakingQueueEntry } from '../../../matchmaking/domain/value-objects/queue-entry.vo.js';

export class AdminGetMatchmakingUseCase {
  constructor(private readonly matchmakingRepository: IMatchmakingRepository) {}

  async execute(): Promise<{ riichi: MatchmakingQueueEntry[]; chinese: MatchmakingQueueEntry[] }> {
    const [riichi, chinese] = await Promise.all([
      this.matchmakingRepository.getQueue('riichi'),
      this.matchmakingRepository.getQueue('chinese'),
    ]);
    return { riichi, chinese };
  }
}
