import { TableStatus } from '@prisma/client';
import { IsIn } from 'class-validator';
import { TABLE_STATUS_VALUES } from './table-status-values';

export class UpdateTableStatusDto {
  @IsIn(TABLE_STATUS_VALUES)
  status!: TableStatus;
}
