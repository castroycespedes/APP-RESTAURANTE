import { TableShape, TableStatus } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TABLE_STATUS_VALUES } from './table-status-values';

export class CreateRestaurantTableDto {
  @IsString()
  diningAreaId!: string;

  @IsOptional()
  @IsString()
  assignedWaiterId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsEnum(TableShape)
  shape!: TableShape;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsIn(TABLE_STATUS_VALUES)
  status?: TableStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  posX?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  posY?: number;
}
