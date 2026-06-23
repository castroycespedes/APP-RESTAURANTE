import { PrintJobStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdatePrintJobStatusDto {
  @IsEnum(PrintJobStatus)
  status!: PrintJobStatus;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}
