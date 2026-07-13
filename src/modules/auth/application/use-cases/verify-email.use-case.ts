import { Injectable, BadRequestException } from '@nestjs/common';
import { IUserRepository } from '../../domain/user.repository.js';
import { RedisOtpService } from '../../infrastructure/otp/redis-otp.service.js';

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly otpService: RedisOtpService,
  ) {}

  async execute(dto: { email: string; otp: string }): Promise<void> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('OTP_INVALID_OR_EXPIRED');
    }

    const isValid = await this.otpService.verifyOtp(user.id, dto.otp);
    if (!isValid) {
      throw new BadRequestException('OTP_INVALID_OR_EXPIRED');
    }

    user.verifyEmail();
    await this.userRepository.save(user);
  }
}
