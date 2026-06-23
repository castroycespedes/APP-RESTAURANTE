import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveLogoDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;
}
