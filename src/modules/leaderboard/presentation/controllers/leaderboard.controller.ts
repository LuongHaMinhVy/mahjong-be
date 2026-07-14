import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../../auth/presentation/guards/jwt.guard.js';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator.js';
import { ApiResponseDto } from '../../../../shared/dto/api-response.dto.js';
import { GetLeaderboardUseCase } from '../../application/use-cases/get-leaderboard.use-case.js';
import { LeaderboardQueryDto } from '../dto/leaderboard-query.dto.js';

@Controller('leaderboard')
@UseGuards(JwtGuard)
export class LeaderboardController {
  constructor(private readonly getLeaderboardUseCase: GetLeaderboardUseCase) {}

  @Get()
  async getLeaderboard(
    @CurrentUser('sub') userId: string,
    @Query() query: LeaderboardQueryDto,
  ) {
    const data = await this.getLeaderboardUseCase.execute({
      userId,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    });
    return new ApiResponseDto(true, 'Lấy bảng xếp hạng thành công', data);
  }
}
