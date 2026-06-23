import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  employeeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  documentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  position?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
