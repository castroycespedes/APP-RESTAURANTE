import { OrderItemStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export const KITCHEN_ITEM_STATUSES = [
  OrderItemStatus.PREPARING,
  OrderItemStatus.READY,
  OrderItemStatus.SERVED,
  OrderItemStatus.CANCELLED
] as const;

export class UpdateTicketItemStatusDto {
  @IsIn(KITCHEN_ITEM_STATUSES)
  status!: OrderItemStatus;
}
