import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  value?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  group?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
