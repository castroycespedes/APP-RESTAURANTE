import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateMeasurementUnitDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  baseCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  toBaseFactor?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
