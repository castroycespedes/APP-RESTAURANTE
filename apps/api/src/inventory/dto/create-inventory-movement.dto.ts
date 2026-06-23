import { InventoryMovementType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateInventoryMovementDto {
  @IsUUID()
  ingredientId!: string;

  @IsEnum(InventoryMovementType)
  type!: InventoryMovementType;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;
}
