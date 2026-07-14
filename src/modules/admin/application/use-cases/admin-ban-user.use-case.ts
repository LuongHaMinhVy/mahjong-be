import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { NotFoundException } from '../../../../shared/exceptions/domain.exception.js';

export interface AdminBanUserInput {
  userId: string;
  durationMinutes: number | null; // null means unban
}

export class AdminBanUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: AdminBanUserInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundException('User', input.userId);
    }

    if (input.durationMinutes === null) {
      user.ban(null);
    } else {
      const until = new Date();
      until.setMinutes(until.getMinutes() + input.durationMinutes);
      user.ban(until);
    }

    await this.userRepository.save(user);
  }
}
