import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateEmployeeDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @MaxLength(40)
  employeeCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  documentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  position?: string;
}
