import { PrinterTargetType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePrinterConfigDto {
  @IsString()
  name!: string;

  @IsEnum(PrinterTargetType)
  targetType!: PrinterTargetType;

  @IsOptional()
  @IsString()
  diningAreaId?: string;

  @IsOptional()
  @IsString()
  menuCategoryId?: string;

  @IsOptional()
  @IsString()
  stationName?: string;

  @IsOptional()
  @IsString()
  printerName?: string;

  @IsOptional()
  @IsString()
  networkAddress?: string;

  @IsOptional()
  @IsInt()
  @Min(58)
  paperWidthMm?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
