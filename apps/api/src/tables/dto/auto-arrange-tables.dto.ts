import { IsOptional, IsString } from 'class-validator';

export class AutoArrangeTablesDto {
  @IsOptional()
  @IsString()
  areaId?: string;
}
