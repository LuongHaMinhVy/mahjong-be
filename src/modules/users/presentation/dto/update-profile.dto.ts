import {
  IsString,
  IsOptional,
  MinLength,
  IsIn,
  IsBoolean,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  @IsIn(['vi', 'en', 'ja', 'zh'])
  locale?: string;

  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;
}
