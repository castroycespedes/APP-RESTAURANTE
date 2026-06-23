import { IsOptional, IsString } from 'class-validator';

export class RemoveOrderItemDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
