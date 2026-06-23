import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateIngredientDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  averageCost?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
