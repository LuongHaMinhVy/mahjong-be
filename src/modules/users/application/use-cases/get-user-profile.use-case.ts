import { Injectable } from '@nestjs/common';
import { IUserRepository } from '../../../auth/domain/user.repository.js';
import { IUserStatsRepository } from '../../domain/repositories/user-stats.repository.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';
import { UserStats } from '../../domain/value-objects/user-stats.vo.js';

export interface UserProfileResponse {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  elo: number;
  createdAt: Date;
  stats: UserStats;
}

@Injectable()
export class GetUserProfileUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly userStatsRepo: IUserStatsRepository
  ) {}

  async execute(userId: string): Promise<UserProfileResponse> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new DomainException('NOT_FOUND', 'User not found');
    }

    const stats = await this.userStatsRepo.getStats(userId);

    return {
      id: user.id,
      email: user.email.getValue(),
      displayName: user.displayName,
      avatar: user.avatar,
      elo: user.elo,
      createdAt: user.createdAt,
      stats,
    };
  }
}
