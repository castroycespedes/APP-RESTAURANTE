import { KitchenTicketStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateTicketStatusDto {
  @IsEnum(KitchenTicketStatus)
  status!: KitchenTicketStatus;
}
