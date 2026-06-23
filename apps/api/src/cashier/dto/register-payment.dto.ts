import { DiscountType, PaymentMethod, TableStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class PaymentLineDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class CheckoutDiscountDto {
  @IsOptional()
  @IsEnum(DiscountType)
  type?: DiscountType | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;
}

export class RegisterPaymentDto {
  @IsOptional()
  @IsString()
  cashRegisterId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentLineDto)
  payments?: PaymentLineDto[];

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tipAmount?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutDiscountDto)
  discount?: CheckoutDiscountDto;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsIn([TableStatus.AVAILABLE, TableStatus.CLEANING])
  closeTableStatus?: Extract<TableStatus, 'AVAILABLE' | 'CLEANING'>;
}
