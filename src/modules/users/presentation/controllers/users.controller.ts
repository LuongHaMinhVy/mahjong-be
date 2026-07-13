import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../../auth/presentation/guards/jwt.guard.js';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator.js';
import { ApiResponseDto } from '../../../../shared/dto/api-response.dto.js';
import { UpdateProfileDto } from '../dto/update-profile.dto.js';
import { MatchHistoryQueryDto } from '../dto/match-history-query.dto.js';
import { GetUserProfileUseCase } from '../../application/use-cases/get-user-profile.use-case.js';
import { UpdateUserProfileUseCase } from '../../application/use-cases/update-user-profile.use-case.js';
import { GetMatchHistoryUseCase } from '../../application/use-cases/get-match-history.use-case.js';

@Controller('users')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(
    private readonly getProfileUseCase: GetUserProfileUseCase,
    private readonly updateProfileUseCase: UpdateUserProfileUseCase,
    private readonly getMatchHistoryUseCase: GetMatchHistoryUseCase,
  ) {}

  @Get('profile')
  async getProfile(@CurrentUser('sub') userId: string) {
    const data = await this.getProfileUseCase.execute(userId);
    return new ApiResponseDto(true, 'Lấy thông tin profile thành công', data);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const data = await this.updateProfileUseCase.execute({
      userId,
      ...dto,
    });
    return new ApiResponseDto(true, 'Cập nhật profile thành công', data);
  }

  @Get('match-history')
  async getMatchHistory(
    @CurrentUser('sub') userId: string,
    @Query() query: MatchHistoryQueryDto,
  ) {
    const data = await this.getMatchHistoryUseCase.execute(userId, query);
    return new ApiResponseDto(true, 'Lấy lịch sử đấu thành công', data);
  }
}
