import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { RegisterDto } from '../dto/register.dto.js';
import { LoginDto } from '../dto/login.dto.js';
import { VerifyEmailDto } from '../dto/verify-email.dto.js';
import { RegisterUseCase } from '../../application/use-cases/register.use-case.js';
import { VerifyEmailUseCase } from '../../application/use-cases/verify-email.use-case.js';
import { LoginUseCase } from '../../application/use-cases/login.use-case.js';
import { RefreshUseCase } from '../../application/use-cases/refresh.use-case.js';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case.js';
import { GoogleLoginUseCase } from '../../application/use-cases/google-login.use-case.js';
import { JwtGuard } from '../guards/jwt.guard.js';
import { IUserRepository } from '../../domain/user.repository.js';
import { ApiResponseDto } from '../../../../shared/dto/api-response.dto.js';
import { GoogleLoginDto } from '../dto/google-login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly googleLoginUseCase: GoogleLoginUseCase,
    private readonly userRepository: IUserRepository,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    await this.registerUseCase.execute(dto);
    return new ApiResponseDto(
      true,
      'Vui lòng kiểm tra email để xác thực',
      null,
    );
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.verifyEmailUseCase.execute(dto);
    return new ApiResponseDto(true, 'Xác thực email thành công', null);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.loginUseCase.execute(dto);

    // Set httpOnly refresh cookie
    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return new ApiResponseDto(true, 'Đăng nhập thành công', {
      accessToken: result.accessToken,
      user: result.user,
    });
  }

  @Post('google')
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.googleLoginUseCase.execute(dto.idToken);

    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return new ApiResponseDto(true, 'Đăng nhập Google thành công', {
      accessToken: result.accessToken,
      user: result.user,
    });
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies as
      Record<string, string | undefined> | undefined;
    const oldToken = cookies?.refresh_token;
    if (!oldToken) {
      throw new UnauthorizedException('REFRESH_TOKEN_INVALID');
    }

    const result = await this.refreshUseCase.execute(oldToken);

    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return new ApiResponseDto(true, 'Làm mới token thành công', {
      accessToken: result.accessToken,
    });
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies as
      Record<string, string | undefined> | undefined;
    const token = cookies?.refresh_token;
    if (token) {
      await this.logoutUseCase.execute(token);
    }
    response.clearCookie('refresh_token', { path: '/auth/refresh' });
    return new ApiResponseDto(true, 'Đăng xuất thành công', null);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  async me(@Req() request: Request & { user: { sub: string } }) {
    const user = await this.userRepository.findById(request.user.sub);
    if (!user) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }
    return new ApiResponseDto(true, 'Lấy thông tin người dùng thành công', {
      id: user.id,
      email: user.email.getValue(),
      displayName: user.displayName,
      elo: user.elo,
      avatar: user.avatar,
    });
  }
}
