import { IsOptional, IsString } from 'class-validator';

export class AssignWaiterDto {
  @IsOptional()
  @IsString()
  waiterId?: string;
}
