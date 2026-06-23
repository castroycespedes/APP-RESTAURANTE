import { MenuItemType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  categoryId!: string;

  @IsEnum(MenuItemType)
  type!: MenuItemType;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  preparationTimeMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  showInPublicMenu?: boolean;

  @IsOptional()
  @IsBoolean()
  showForWaiters?: boolean;
}
