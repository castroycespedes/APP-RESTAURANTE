import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class OpenTableOrderDto {
  @IsString()
  tableId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  joinedTableIds?: string[];
}
