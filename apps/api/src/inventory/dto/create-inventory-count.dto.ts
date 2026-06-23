import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreateInventoryCountItemDto {
  @IsUUID()
  ingredientId!: string;

  @IsNumber()
  @Min(0)
  countedStock!: number;
}

export class CreateInventoryCountDto {
  @IsString()
  @MaxLength(30)
  period!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryCountItemDto)
  items!: CreateInventoryCountItemDto[];
}
