import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../../auth/presentation/guards/jwt.guard.js';
import { ApiResponseDto } from '../../../../shared/dto/api-response.dto.js';
import { GetGameReplayUseCase } from '../../application/use-cases/get-game-replay.use-case.js';

@Controller('games')
@UseGuards(JwtGuard)
export class GameReplayController {
  constructor(private readonly getGameReplayUseCase: GetGameReplayUseCase) {}

  @Get(':gameResultId/replay')
  async getReplay(@Param('gameResultId') gameResultId: string) {
    const replay = await this.getGameReplayUseCase.execute(gameResultId);
    return new ApiResponseDto(true, 'Lấy thông tin replay thành công', {
      id: replay.id,
      gameResultId: replay.gameResultId,
      actions: replay.actions,
      createdAt: replay.createdAt,
    });
  }
}
