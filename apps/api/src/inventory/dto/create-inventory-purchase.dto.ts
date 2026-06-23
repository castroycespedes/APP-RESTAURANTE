import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreateInventoryPurchaseItemDto {
  @IsUUID()
  ingredientId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsString()
  @MaxLength(40)
  unit!: string;

  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreateInventoryPurchaseDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  invoiceNumber?: string;

  @IsOptional()
  @IsDateString()
  purchasedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryPurchaseItemDto)
  items!: CreateInventoryPurchaseItemDto[];
}
