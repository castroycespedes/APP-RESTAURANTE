import { Injectable, NotFoundException } from '@nestjs/common';
import { PrintJobStatus, PrinterTargetType, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePrinterConfigDto } from './dto/create-printer-config.dto';

const kitchenTicketForPrintInclude = {
  order: {
    include: {
      waiter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      table: {
        include: {
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
            include: {
              category: true
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
export class PrintService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  findQueue() {
    return this.prisma.printJob.findMany({
      include: {
        printerConfig: true,
        kitchenTicket: {
          select: {
            id: true,
            status: true,
            createdAt: true
          }
        }
      },
      orderBy: [{ status: 'asc' }, { queuedAt: 'asc' }]
    });
  }

  findPrinterConfigs() {
    return this.prisma.printerConfig.findMany({
      orderBy: [{ targetType: 'asc' }, { name: 'asc' }]
    });
  }

  async createPrinterConfig(dto: CreatePrinterConfigDto, actorId: string) {
    const printerConfig = await this.prisma.printerConfig.create({
      data: dto
    });

    await this.auditService.log({
      userId: actorId,
      action: 'print.printer-config.create',
      entity: 'PrinterConfig',
      entityId: printerConfig.id,
      after: printerConfig
    });

    return printerConfig;
  }

  async enqueueKitchenTicket(ticketId: string, actorId: string) {
    const ticket = await this.prisma.kitchenTicket.findUnique({
      where: { id: ticketId },
      include: kitchenTicketForPrintInclude
    });

    if (!ticket) {
      throw new NotFoundException('Kitchen ticket not found');
    }

    const printerConfig = await this.resolvePrinterConfig(ticket);
    const payload = this.buildKitchenTicketPayload(ticket);

    const printJob = await this.prisma.printJob.create({
      data: {
        kitchenTicketId: ticket.id,
        printerConfigId: printerConfig?.id,
        createdById: actorId,
        status: PrintJobStatus.QUEUED,
        payload
      },
      include: {
        printerConfig: true,
        kitchenTicket: true
      }
    });

    await this.auditService.log({
      userId: actorId,
      action: 'print.job.enqueue-kitchen-ticket',
      entity: 'PrintJob',
      entityId: printJob.id,
      after: {
        kitchenTicketId: ticket.id,
        printerConfigId: printerConfig?.id
      }
    });

    return printJob;
  }

  async updateJobStatus(jobId: string, status: PrintJobStatus, actorId: string, errorMessage?: string) {
    const current = await this.prisma.printJob.findUnique({ where: { id: jobId } });

    if (!current) {
      throw new NotFoundException('Print job not found');
    }

    const printJob = await this.prisma.printJob.update({
      where: { id: jobId },
      data: {
        status,
        errorMessage,
        attempts: status === PrintJobStatus.FAILED ? { increment: 1 } : undefined,
        startedAt: status === PrintJobStatus.PRINTING && !current.startedAt ? new Date() : undefined,
        completedAt: status === PrintJobStatus.COMPLETED ? new Date() : undefined
      }
    });

    await this.auditService.log({
      userId: actorId,
      action: 'print.job.status.update',
      entity: 'PrintJob',
      entityId: jobId,
      before: current,
      after: printJob
    });

    return printJob;
  }

  private async resolvePrinterConfig(ticket: Prisma.KitchenTicketGetPayload<{ include: typeof kitchenTicketForPrintInclude }>) {
    const categoryIds = ticket.items.map((item) => item.orderItem.menuItem.categoryId);
    const diningAreaId = ticket.order.table.diningAreaId;

    return this.prisma.printerConfig.findFirst({
      where: {
        isActive: true,
        OR: [
          { targetType: PrinterTargetType.MENU_CATEGORY, menuCategoryId: { in: categoryIds } },
          { targetType: PrinterTargetType.DINING_AREA, diningAreaId },
          { targetType: PrinterTargetType.KITCHEN_STATION, stationName: ticket.stationName ?? 'Cocina' },
          { isDefault: true }
        ]
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });
  }

  private buildKitchenTicketPayload(
    ticket: Prisma.KitchenTicketGetPayload<{ include: typeof kitchenTicketForPrintInclude }>
  ): Prisma.InputJsonObject {
    return {
      type: 'KITCHEN_TICKET',
      ticketId: ticket.id,
      orderNumber: ticket.order.orderNumber,
      table: {
        id: ticket.order.table.id,
        name: ticket.order.table.name,
        number: ticket.order.table.number,
        diningArea: ticket.order.table.diningArea.name
      },
      waiter: ticket.order.waiter
        ? {
            id: ticket.order.waiter.id,
            name: `${ticket.order.waiter.firstName} ${ticket.order.waiter.lastName}`.trim(),
            email: ticket.order.waiter.email
          }
        : null,
      sentAt: ticket.createdAt.toISOString(),
      items: ticket.items.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        name: item.orderItem.menuItem.name,
        quantity: item.orderItem.quantity,
        notes: item.notes ?? item.orderItem.notes,
        modifiers: item.orderItem.modifiers.map((modifier) => ({
          name: modifier.nameSnapshot,
          quantity: modifier.quantity
        }))
      }))
    };
  }
}
