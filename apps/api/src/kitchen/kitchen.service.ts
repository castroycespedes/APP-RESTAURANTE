import { Injectable, NotFoundException } from '@nestjs/common';
import { KitchenTicketStatus, OrderItemStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { KitchenGateway } from './kitchen.gateway';

const kitchenTicketInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      waiterId: true,
      waiter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      table: {
        select: {
          id: true,
          name: true,
          number: true,
          diningArea: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  },
  items: {
    include: {
      orderItem: {
        include: {
          menuItem: {
            select: {
              id: true,
              name: true
            }
          },
          modifiers: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  }
} satisfies Prisma.KitchenTicketInclude;

@Injectable()
export class KitchenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly kitchenGateway: KitchenGateway
  ) {}

  findActiveTickets() {
    return this.prisma.kitchenTicket.findMany({
      where: {
        status: {
          in: [
            KitchenTicketStatus.RECEIVED,
            KitchenTicketStatus.PREPARING,
            KitchenTicketStatus.READY,
            KitchenTicketStatus.DELIVERED
          ]
        }
      },
      include: kitchenTicketInclude,
      orderBy: { createdAt: 'asc' }
    });
  }

  async updateTicketStatus(ticketId: string, status: KitchenTicketStatus, actorId: string) {
    const current = await this.ensureTicket(ticketId);
    const itemStatus = this.itemStatusForTicketStatus(status);
    const orderItemIds = current.items.map((item) => item.orderItemId);

    await this.prisma.$transaction(async (tx) => {
      await tx.kitchenTicket.update({
        where: { id: ticketId },
        data: {
          status,
          readyAt: status === KitchenTicketStatus.READY ? new Date() : undefined
        }
      });

      if (itemStatus) {
        await tx.kitchenTicketItem.updateMany({
          where: { kitchenTicketId: ticketId },
          data: { status: itemStatus }
        });

        await tx.orderItem.updateMany({
          where: { id: { in: orderItemIds } },
          data: {
            status: itemStatus,
            cancelledAt: itemStatus === OrderItemStatus.CANCELLED ? new Date() : undefined
          }
        });
      }
    });

    const ticket = await this.ensureTicket(ticketId);

    await this.auditService.log({
      userId: actorId,
      action: 'kitchen.ticket.status.update',
      entity: 'KitchenTicket',
      entityId: ticketId,
      before: current,
      after: ticket
    });

    this.kitchenGateway.emitTicketUpdated(ticket);

    if (status === KitchenTicketStatus.READY) {
      this.kitchenGateway.emitWaiterTicketReady(ticket.order.waiterId, ticket);
    }

    return ticket;
  }

  async updateTicketItemStatus(ticketId: string, itemId: string, status: OrderItemStatus, actorId: string) {
    const current = await this.prisma.kitchenTicketItem.findFirst({
      where: {
        id: itemId,
        kitchenTicketId: ticketId
      },
      include: {
        orderItem: true,
        kitchenTicket: {
          include: {
            order: true
          }
        }
      }
    });

    if (!current) {
      throw new NotFoundException('Kitchen ticket item not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.kitchenTicketItem.update({
        where: { id: itemId },
        data: { status }
      });

      await tx.orderItem.update({
        where: { id: current.orderItemId },
        data: {
          status,
          cancelledAt: status === OrderItemStatus.CANCELLED ? new Date() : undefined
        }
      });
    });

    const ticket = await this.ensureTicket(ticketId);

    await this.auditService.log({
      userId: actorId,
      action: 'kitchen.ticket-item.status.update',
      entity: 'KitchenTicketItem',
      entityId: itemId,
      before: current,
      after: { status }
    });

    this.kitchenGateway.emitTicketItemUpdated(ticket);

    if (status === OrderItemStatus.READY) {
      this.kitchenGateway.emitWaiterTicketReady(ticket.order.waiterId, ticket);
    }

    return ticket;
  }

  private async ensureTicket(ticketId: string) {
    const ticket = await this.prisma.kitchenTicket.findUnique({
      where: { id: ticketId },
      include: kitchenTicketInclude
    });

    if (!ticket) {
      throw new NotFoundException('Kitchen ticket not found');
    }

    return ticket;
  }

  private itemStatusForTicketStatus(status: KitchenTicketStatus) {
    if (status === KitchenTicketStatus.PREPARING) {
      return OrderItemStatus.PREPARING;
    }

    if (status === KitchenTicketStatus.READY) {
      return OrderItemStatus.READY;
    }

    if (status === KitchenTicketStatus.DELIVERED) {
      return OrderItemStatus.SERVED;
    }

    if (status === KitchenTicketStatus.CANCELLED) {
      return OrderItemStatus.CANCELLED;
    }

    return undefined;
  }
}
