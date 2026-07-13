import { Injectable, ConflictException } from '@nestjs/common';
import { IUserRepository } from '../../domain/user.repository.js';
import { User } from '../../domain/user.entity.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { Password } from '../../domain/value-objects/password.vo.js';
import { RedisOtpService } from '../../infrastructure/otp/redis-otp.service.js';
import { ResendEmailService } from '../../infrastructure/email/resend-email.service.js';
import crypto from 'crypto';

@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly otpService: RedisOtpService,
    private readonly emailService: ResendEmailService,
  ) {}

  async execute(dto: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<void> {
    const emailVo = new Email(dto.email);
    const existing = await this.userRepository.findByEmail(emailVo.getValue());
    if (existing) {
      throw new ConflictException('EMAIL_ALREADY_EXISTS');
    }

    const passwordVo = Password.create(dto.password);

    const user = new User({
      id: crypto.randomUUID(),
      email: emailVo,
      password: passwordVo,
      displayName: dto.displayName,
      elo: 1000,
      isEmailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.userRepository.save(user);

    const otp = await this.otpService.generateOtp(user.id);
    await this.emailService.sendVerificationEmail(user.email.getValue(), otp);
  }
}
