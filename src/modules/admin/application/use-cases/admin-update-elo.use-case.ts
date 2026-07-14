import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { NotFoundException } from '../../../../shared/exceptions/domain.exception.js';

export interface AdminUpdateEloInput {
  userId: string;
  newElo: number;
}

export class AdminUpdateEloUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: AdminUpdateEloInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundException('User', input.userId);
    }

    user.updateElo(input.newElo);
    await this.userRepository.save(user);
  }
}
