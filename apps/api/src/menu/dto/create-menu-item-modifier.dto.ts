import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateMenuItemModifierDto {
  @IsString()
  menuItemId!: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  priceDelta!: number;

  @IsBoolean()
  isRequired!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxQuantity?: number;
}
