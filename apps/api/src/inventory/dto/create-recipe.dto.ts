import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRecipeDto {
  @IsString()
  menuItemId!: string;

  @IsString()
  ingredientId!: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
