import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateRecipeDto {
  @IsOptional()
  @IsString()
  menuItemId?: string;

  @IsOptional()
  @IsString()
  ingredientId?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
