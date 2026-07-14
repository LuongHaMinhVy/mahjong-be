import { IsInt, Min, Max } from 'class-validator';

export class UpdateEloDto {
  @IsInt()
  @Min(0)
  @Max(9999)
  elo!: number;
}
