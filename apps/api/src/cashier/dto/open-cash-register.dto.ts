import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenCashRegisterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsNumber()
  @Min(0)
  openingAmount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
