import { IsInt, IsOptional, Min } from 'class-validator';

export class BanUserDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;
}
