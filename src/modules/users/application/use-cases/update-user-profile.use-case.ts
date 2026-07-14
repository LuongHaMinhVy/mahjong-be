import { Injectable } from '@nestjs/common';
import { IUserRepository } from '../../../auth/domain/user.repository.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export interface UpdateUserProfileRequest {
  userId: string;
  displayName?: string;
  avatar?: string | null;
  locale?: string;
  soundEnabled?: boolean;
}

export interface UpdateUserProfileResponse {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  elo: number;
  locale: string;
  soundEnabled: boolean;
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

    if (request.locale !== undefined) {
      user.settings.updateLocale(request.locale);
    }

    if (request.soundEnabled !== undefined) {
      user.settings.updateSoundEnabled(request.soundEnabled);
    }

    await this.userRepo.save(user);

    return {
      id: user.id,
      email: user.email.getValue(),
      displayName: user.displayName,
      avatar: user.avatar,
      elo: user.elo,
      locale: user.settings.locale,
      soundEnabled: user.settings.soundEnabled,
      updatedAt: user.updatedAt,
    };
  }
}
