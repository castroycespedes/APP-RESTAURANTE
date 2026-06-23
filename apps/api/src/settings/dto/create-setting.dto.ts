import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSettingDto {
  @IsString()
  @MaxLength(120)
  key!: string;

  @IsString()
  @MaxLength(120)
  label!: string;

  @IsString()
  @MaxLength(500)
  value!: string;

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
