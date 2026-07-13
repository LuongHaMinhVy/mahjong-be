import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class ResendEmailService {
  private resend: Resend | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async sendVerificationEmail(email: string, otp: string): Promise<void> {
    if (!this.resend) {
      console.warn(
        `[EMAIL BYPASS] Resend API Key is missing. OTP for ${email} is ${otp}`,
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: 'Mahjong Game <onboarding@resend.dev>',
        to: email,
        subject: 'Xác thực tài khoản Mahjong',
        html: `<p>Mã xác thực OTP của bạn là: <strong>${otp}</strong>. Mã này có hiệu lực trong 5 phút.</p>`,
      });
    } catch (error) {
      console.error('Failed to send email via Resend:', error);
      throw error;
    }
  }
}
