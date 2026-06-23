import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class AddOrderItemModifierDto {
  @IsString()
  modifierId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class AddOrderItemDto {
  @IsString()
  menuItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddOrderItemModifierDto)
  modifiers?: AddOrderItemModifierDto[];
}
