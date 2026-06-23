import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateMeasurementUnitDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  baseCode!: string;

  @IsNumber()
  @Min(0.000001)
  toBaseFactor!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
