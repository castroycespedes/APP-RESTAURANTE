import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateIngredientDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsString()
  unit!: string;

  @IsNumber()
  @Min(0)
  currentStock!: number;

  @IsNumber()
  @Min(0)
  minimumStock!: number;

  @IsNumber()
  @Min(0)
  averageCost!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
