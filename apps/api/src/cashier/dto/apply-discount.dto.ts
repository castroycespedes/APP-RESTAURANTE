import { DiscountType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ApplyDiscountDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsEnum(DiscountType)
  type!: DiscountType;

  @IsNumber()
  @Min(0)
  value!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
