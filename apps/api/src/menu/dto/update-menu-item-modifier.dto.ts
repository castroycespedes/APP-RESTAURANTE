import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateMenuItemModifierDto {
  @IsOptional()
  @IsString()
  menuItemId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceDelta?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxQuantity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
