import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { type User } from '../../../auth/domain/user.entity.js';

export interface AdminGetUsersInput {
  page: number;
  limit: number;
  search?: string;
}

export class AdminGetUsersUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: AdminGetUsersInput): Promise<{ users: User[]; total: number }> {
    return this.userRepository.findMany(input);
  }
}
