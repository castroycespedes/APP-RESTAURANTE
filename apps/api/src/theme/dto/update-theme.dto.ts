import { IsBoolean, IsHexColor, IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class UpdateThemeDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  restaurantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string | null;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @IsOptional()
  @IsHexColor()
  backgroundColor?: string;

  @IsOptional()
  @IsHexColor()
  textColor?: string;

  @IsOptional()
  @IsHexColor()
  buttonColor?: string;

  @IsOptional()
  @IsHexColor()
  cardColor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}px$/)
  borderRadius?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fontFamily?: string;

  @IsOptional()
  @IsBoolean()
  darkModeEnabled?: boolean;
}
