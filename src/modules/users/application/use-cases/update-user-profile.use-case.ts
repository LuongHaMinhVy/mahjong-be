import { Injectable } from '@nestjs/common';
import { IUserRepository } from '../../../auth/domain/user.repository.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export interface UpdateUserProfileRequest {
  userId: string;
  displayName?: string;
  avatar?: string | null;
}

export interface UpdateUserProfileResponse {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  elo: number;
  updatedAt: Date;
}

@Injectable()
export class UpdateUserProfileUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(
    request: UpdateUserProfileRequest,
  ): Promise<UpdateUserProfileResponse> {
    const user = await this.userRepo.findById(request.userId);
    if (!user) {
      throw new DomainException('NOT_FOUND', 'User not found');
    }

    if (request.displayName !== undefined) {
      user.updateDisplayName(request.displayName);
    }

    if (request.avatar !== undefined) {
      user.updateAvatar(request.avatar);
    }

    await this.userRepo.save(user);

    return {
      id: user.id,
      email: user.email.getValue(),
      displayName: user.displayName,
      avatar: user.avatar,
      elo: user.elo,
      updatedAt: user.updatedAt,
    };
  }
}
