import { IsOptional, IsString, MinLength, MaxLength, Matches, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  surname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  patronymic?: string;

  @IsOptional()
  @IsString()
  @Matches(/(^[a-zA-Z]+\/[a-zA-Z_]+$|UTC)/, {
    message: 'Timezone must be a valid IANA string, e.g. "Europe/Moscow"',
  })
  @Transform(({ value }) => value?.trim())
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  notifyBeforeMinutes?: number;
}
