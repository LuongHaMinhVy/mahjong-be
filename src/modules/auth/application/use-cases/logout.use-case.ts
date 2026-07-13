import { Injectable } from '@nestjs/common';
import { SessionService } from '../../infrastructure/session/session.service.js';

@Injectable()
export class LogoutUseCase {
  constructor(private readonly sessionService: SessionService) {}

  async execute(refreshToken: string): Promise<void> {
    await this.sessionService.revokeSession(refreshToken);
  }
}
