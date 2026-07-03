import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { KitchenTicketStatus, OrderItemStatus, OrderStatus, Prisma, TableStatus, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { InventoryService } from '../inventory/inventory.service';
import { KitchenGateway } from '../kitchen/kitchen.gateway';
import { PrismaService } from '../prisma/prisma.service';
import type { AddOrderItemDto, AddOrderItemModifierDto } from './dto/add-order-item.dto';
import type { OpenOrderDto } from './dto/open-order.dto';
import type { RemoveOrderItemDto } from './dto/remove-order-item.dto';
import type { UpdateOrderItemDto } from './dto/update-order-item.dto';

const OPEN_ORDER_STATUSES = [
  OrderStatus.DRAFT,
  OrderStatus.OPEN,
  OrderStatus.SENT_TO_KITCHEN,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
  OrderStatus.WAITING_PAYMENT
];

const orderInclude = {
  table: {
    select: {
      id: true,
      name: true,
      number: true,
      status: true,
      diningAreaId: true,
      assignedWaiterId: true
    }
  },
  waiter: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  },
  customer: true,
  items: {
    include: {
      menuItem: {
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
          preparationTimeMinutes: true
        }
      },
      modifiers: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  },
  kitchenTickets: {
    include: {
      items: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  }
} satisfies Prisma.OrderInclude;

const managerRoles = new Set<UserRole>([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly kitchenGateway: KitchenGateway,
    private readonly inventoryService: InventoryService
  ) {}

  async openOrder(tableId: string, waiter: AuthUser, dto: OpenOrderDto = {}) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id: tableId },
      include: {
        orders: {
          where: { status: { in: OPEN_ORDER_STATUSES } },
          include: orderInclude,
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!table || !table.isActive) {
      throw new NotFoundException('Table not found');
    }

    if (waiter.role === UserRole.WAITER && table.assignedWaiterId !== waiter.id) {
      throw new ForbiddenException('Waiter can only open orders on assigned tables');
    }

    if (table.orders[0]) {
      if (waiter.role === UserRole.WAITER && table.orders[0].waiterId && table.orders[0].waiterId !== waiter.id) {
        throw new ForbiddenException('This table already has an order from another waiter');
      }

      return table.orders[0];
    }

    if (table.status === TableStatus.BLOCKED) {
      throw new ConflictException('No se puede abrir pedido en una mesa bloqueada.');
    }

    if (table.status === TableStatus.CLEANING) {
      throw new ConflictException('No se puede abrir pedido en una mesa en limpieza.');
    }

    if (table.status !== TableStatus.AVAILABLE && table.status !== TableStatus.RESERVED) {
      throw new ConflictException('Esta mesa ya tiene un pedido activo.');
    }

    const joinedTables = dto.joinedTableIds?.length
      ? await this.ensureJoinableTables(dto.joinedTableIds, tableId, waiter.id)
      : [];
    const guestNote = dto.guestCount ? `Personas atendidas: ${dto.guestCount}` : '';
    const joinedNote = joinedTables.length
      ? `Mesas unidas: ${joinedTables.map((item) => `${item.name} ${item.number}`.trim()).join(', ')}`
      : '';

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: this.createOrderNumber(),
          tableId,
          waiterId: waiter.id,
          status: OrderStatus.OPEN,
          notes: [guestNote, joinedNote].filter(Boolean).join(' | ') || undefined
        },
        include: orderInclude
      });

      await tx.restaurantTable.update({
        where: { id: tableId },
        data: { status: TableStatus.OCCUPIED, assignedWaiterId: waiter.id }
      });

      if (joinedTables.length > 0) {
        await tx.restaurantTable.updateMany({
          where: { id: { in: joinedTables.map((item) => item.id) } },
          data: { status: TableStatus.OCCUPIED, assignedWaiterId: waiter.id }
        });
      }

      return order;
    });
  }

  async findOpenOrderByTable(tableId: string, user: AuthUser) {
    await this.ensureTableAccess(tableId, user);

    return this.prisma.order.findFirst({
      where: {
        tableId,
        status: { in: OPEN_ORDER_STATUSES }
      },
      include: orderInclude,
      orderBy: { createdAt: 'desc' }
    });
  }

  findOrdersForWaiter(waiterId: string) {
    return this.prisma.order.findMany({
      where: {
        waiterId,
        status: { in: OPEN_ORDER_STATUSES }
      },
      include: orderInclude,
      orderBy: { createdAt: 'desc' }
    });
  }

  async addItem(orderId: string, dto: AddOrderItemDto, waiter: AuthUser) {
    const order = await this.ensureOrderAccess(orderId, waiter);
    this.ensureOrderEditable(order.status);

    const menuItem = await this.ensureMenuItemAvailable(dto.menuItemId);
    const modifierPayload = await this.buildModifierPayload(dto.menuItemId, dto.modifiers ?? []);
    const itemTotal = this.calculateItemTotal(Number(menuItem.price), dto.quantity, modifierPayload);

    await this.prisma.orderItem.create({
      data: {
        orderId,
        menuItemId: dto.menuItemId,
        quantity: dto.quantity,
        unitPrice: menuItem.price,
        total: itemTotal,
        status: OrderItemStatus.PENDING,
        notes: dto.notes,
        modifiers: {
          create: modifierPayload
        }
      }
    });

    return this.recalculateAndReturn(orderId);
  }

  async updateItem(orderId: string, itemId: string, dto: UpdateOrderItemDto, user: AuthUser) {
    const order = await this.ensureOrderAccess(orderId, user);
    this.ensureOrderEditable(order.status);

    const current = await this.ensureOrderItem(orderId, itemId);
    const sentCorrection = current.status !== OrderItemStatus.PENDING;
    this.ensureCorrectionAllowed(sentCorrection, dto.correctionReason, user);

    const modifierPayload =
      dto.modifiers === undefined ? undefined : await this.buildModifierPayload(current.menuItemId, dto.modifiers);
    const quantity = dto.quantity ?? current.quantity;
    const modifierTotal = modifierPayload
      ? modifierPayload.reduce((sum, modifier) => sum + Number(modifier.priceDelta) * modifier.quantity, 0)
      : current.modifiers.reduce((sum, modifier) => sum + Number(modifier.priceDelta) * modifier.quantity, 0);
    const total = new Prisma.Decimal((Number(current.unitPrice) + modifierTotal) * quantity);

    await this.prisma.$transaction(async (tx) => {
      if (modifierPayload) {
        await tx.orderItemModifier.deleteMany({ where: { orderItemId: itemId } });
      }

      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          quantity: dto.quantity,
          notes: dto.notes,
          total,
          modifiers: modifierPayload ? { create: modifierPayload } : undefined
        }
      });
    });

    if (sentCorrection) {
      await this.auditService.log({
        userId: user.id,
        action: 'orders.item.correct-after-kitchen',
        entity: 'OrderItem',
        entityId: itemId,
        before: current,
        after: {
          quantity: dto.quantity ?? current.quantity,
          notes: dto.notes ?? current.notes,
          modifierIds: dto.modifiers?.map((modifier) => modifier.modifierId) ?? current.modifiers.map((modifier) => modifier.menuItemModifierId)
        },
        metadata: { reason: dto.correctionReason }
      });
    }

    return this.recalculateAndReturn(orderId);
  }

  async removeItem(orderId: string, itemId: string, dto: RemoveOrderItemDto, user: AuthUser) {
    await this.ensureOrderAccess(orderId, user);
    const current = await this.ensureOrderItem(orderId, itemId);

    if (current.status === OrderItemStatus.PENDING) {
      await this.prisma.orderItemModifier.deleteMany({ where: { orderItemId: itemId } });
      await this.prisma.orderItem.delete({ where: { id: itemId } });
      return this.recalculateAndReturn(orderId);
    }

    this.ensureCorrectionAllowed(true, dto.reason, user);

    await this.prisma.$transaction(async (tx) => {
      await this.inventoryService.registerCancelledOrderItemInTransaction(tx, itemId, current.status, user.id);

      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          status: OrderItemStatus.CANCELLED,
          cancelledAt: new Date()
        }
      });
    });

    await this.auditService.log({
      userId: user.id,
      action: 'orders.item.cancel-after-kitchen',
      entity: 'OrderItem',
      entityId: itemId,
      before: current,
      after: { status: OrderItemStatus.CANCELLED },
      metadata: { reason: dto.reason }
    });

    return this.recalculateAndReturn(orderId);
  }

  async sendPendingItemsToKitchen(orderId: string, waiter: AuthUser) {
    await this.ensureOrderAccess(orderId, waiter);

    const pendingItems = await this.prisma.orderItem.findMany({
      where: {
        orderId,
        status: OrderItemStatus.PENDING
      },
      orderBy: { createdAt: 'asc' }
    });

    if (pendingItems.length === 0) {
      throw new ConflictException('There are no pending products to send to kitchen');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.SENT_TO_KITCHEN }
      });

      await tx.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: TableStatus.WAITING_KITCHEN }
      });

      const ticket = await tx.kitchenTicket.create({
        data: {
          orderId,
          stationName: 'Cocina',
          status: KitchenTicketStatus.RECEIVED,
          items: {
            create: pendingItems.map((item) => ({
              orderItemId: item.id,
              status: OrderItemStatus.SENT,
              notes: item.notes
            }))
          }
        }
      });

      await tx.orderItem.updateMany({
        where: {
          id: { in: pendingItems.map((item) => item.id) }
        },
        data: { status: OrderItemStatus.SENT }
      });

      await this.inventoryService.consumeOrderItemsInTransaction(
        tx,
        pendingItems.map((item) => item.id),
        waiter.id
      );

      return { orderId: order.id, ticketId: ticket.id };
    });

    await this.auditService.log({
      userId: waiter.id,
      action: 'orders.send-to-kitchen',
      entity: 'Order',
      entityId: result.orderId,
      after: {
        ticketId: result.ticketId,
        itemIds: pendingItems.map((item) => item.id)
      }
    });

    const order = await this.recalculateAndReturn(orderId);
    const ticket = await this.prisma.kitchenTicket.findUnique({
      where: { id: result.ticketId },
      include: {
        order: {
          include: {
            table: true,
            waiter: true
          }
        },
        items: {
          include: {
            orderItem: {
              include: {
                menuItem: true,
                modifiers: true
              }
            }
          }
        }
      }
    });

    this.kitchenGateway.emitTicketCreated(ticket);

    return order;
  }

  async markReadyItemsServed(orderId: string, waiter: AuthUser) {
    const orderAccess = await this.ensureOrderAccess(orderId, waiter);

    if (
      orderAccess.status === OrderStatus.PAID ||
      orderAccess.status === OrderStatus.CLOSED ||
      orderAccess.status === OrderStatus.CANCELLED ||
      orderAccess.status === OrderStatus.WAITING_PAYMENT
    ) {
      throw new ConflictException('Esta orden no permite marcar entregas.');
    }

    const deliverableItems = await this.prisma.orderItem.findMany({
      where: {
        orderId,
        status: { in: [OrderItemStatus.SENT, OrderItemStatus.PREPARING, OrderItemStatus.READY] }
      },
      select: { id: true }
    });

    if (deliverableItems.length === 0) {
      throw new ConflictException('No hay productos de cocina para marcar como entregados.');
    }

    const deliverableItemIds = deliverableItems.map((item) => item.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { id: { in: deliverableItemIds } },
        data: { status: OrderItemStatus.SERVED }
      });

      await tx.kitchenTicketItem.updateMany({
        where: { orderItemId: { in: deliverableItemIds } },
        data: { status: OrderItemStatus.SERVED }
      });

      const remainingItems = await tx.orderItem.findMany({
        where: {
          orderId,
          status: { not: OrderItemStatus.CANCELLED }
        },
        select: { status: true }
      });

      const nextOrderStatus = this.statusAfterService(remainingItems.map((item) => item.status));
      const nextTableStatus = this.tableStatusAfterService(remainingItems.map((item) => item.status));

      await tx.order.update({
        where: { id: orderId },
        data: { status: nextOrderStatus }
      });

      await tx.restaurantTable.update({
        where: { id: orderAccess.tableId },
        data: { status: nextTableStatus }
      });

      const tickets = await tx.kitchenTicket.findMany({
        where: { orderId },
        include: { items: true }
      });

      await Promise.all(tickets.map((ticket) => {
        const activeTicketItems = ticket.items.filter((item) => item.status !== OrderItemStatus.CANCELLED);
        const allServed = activeTicketItems.length > 0 && activeTicketItems.every((item) => item.status === OrderItemStatus.SERVED);

        if (!allServed || ticket.status === KitchenTicketStatus.DELIVERED) {
          return Promise.resolve();
        }

        return tx.kitchenTicket.update({
          where: { id: ticket.id },
          data: { status: KitchenTicketStatus.DELIVERED }
        });
      }));
    });

    await this.auditService.log({
      userId: waiter.id,
      action: 'orders.ready-items.served',
      entity: 'Order',
      entityId: orderId,
      after: { itemIds: deliverableItemIds, status: OrderItemStatus.SERVED }
    });

    return this.recalculateAndReturn(orderId);
  }

  async requestPayment(orderId: string, waiter: AuthUser) {
    const order = await this.ensureOrderAccess(orderId, waiter);

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Closed or cancelled orders cannot request payment');
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.WAITING_PAYMENT },
        include: orderInclude
      });

      await tx.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: TableStatus.WAITING_PAYMENT }
      });

      return updated;
    });

    await this.auditService.log({
      userId: waiter.id,
      action: 'orders.request-payment',
      entity: 'Order',
      entityId: orderId,
      before: order,
      after: { status: OrderStatus.WAITING_PAYMENT, tableStatus: TableStatus.WAITING_PAYMENT }
    });

    return updatedOrder;
  }

  async cancelOrder(orderId: string, reason: string, user: AuthUser) {
    const order = await this.ensureOrderAccess(orderId, user);

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Closed or cancelled orders cannot be cancelled');
    }

    if (!reason?.trim()) {
      throw new ConflictException('Cancelling an order requires a reason');
    }

    const items = await this.prisma.orderItem.findMany({
      where: {
        orderId,
        status: { not: OrderItemStatus.CANCELLED }
      },
      include: { modifiers: true }
    });
    const hasKitchenItems = items.some((item) => item.status !== OrderItemStatus.PENDING);

    this.ensureCorrectionAllowed(hasKitchenItems, reason, user);

    const tableStatus = await this.getAfterPaymentTableStatus();
    const result = await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.status !== OrderItemStatus.PENDING) {
          await this.inventoryService.registerCancelledOrderItemInTransaction(tx, item.id, item.status, user.id);
        }
      }

      await tx.orderItem.updateMany({
        where: {
          orderId,
          status: { not: OrderItemStatus.CANCELLED }
        },
        data: {
          status: OrderItemStatus.CANCELLED,
          cancelledAt: new Date()
        }
      });

      await tx.kitchenTicket.updateMany({
        where: { orderId },
        data: { status: KitchenTicketStatus.CANCELLED }
      });

      const cancelledOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason
        },
        include: orderInclude
      });

      await tx.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: tableStatus as TableStatus }
      });

      return cancelledOrder;
    });

    await this.auditService.log({
      userId: user.id,
      action: 'orders.cancel',
      entity: 'Order',
      entityId: orderId,
      before: order,
      after: {
        status: OrderStatus.CANCELLED,
        tableStatus,
        cancelledItemIds: items.map((item) => item.id),
        kitchenItemCount: items.filter((item) => item.status !== OrderItemStatus.PENDING).length
      },
      metadata: { reason }
    });

    this.kitchenGateway.emitTicketUpdated({ orderId, status: KitchenTicketStatus.CANCELLED });

    return result;
  }

  private async ensureTableAccess(tableId: string, user: AuthUser) {
    const table = await this.prisma.restaurantTable.findUnique({ where: { id: tableId } });

    if (!table || !table.isActive) {
      throw new NotFoundException('Table not found');
    }

    if (user.role === UserRole.WAITER && table.assignedWaiterId !== user.id) {
      throw new ForbiddenException('Waiter can only operate assigned tables');
    }

    return table;
  }

  private async ensureOrderAccess(orderId: string, user: AuthUser) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (user.role === UserRole.WAITER && order.waiterId !== user.id) {
      throw new ForbiddenException('Waiter can only operate assigned tables');
    }

    return order;
  }

  private statusAfterService(statuses: OrderItemStatus[]) {
    if (statuses.some((status) => status === OrderItemStatus.READY)) {
      return OrderStatus.READY;
    }

    if (statuses.some((status) => status === OrderItemStatus.PREPARING)) {
      return OrderStatus.PREPARING;
    }

    if (statuses.some((status) => status === OrderItemStatus.SENT)) {
      return OrderStatus.SENT_TO_KITCHEN;
    }

    if (statuses.some((status) => status === OrderItemStatus.PENDING)) {
      return OrderStatus.OPEN;
    }

    if (statuses.some((status) => status === OrderItemStatus.SERVED)) {
      return OrderStatus.SERVED;
    }

    return OrderStatus.OPEN;
  }

  private tableStatusAfterService(statuses: OrderItemStatus[]) {
    if (statuses.some((status) => status === OrderItemStatus.READY)) {
      return TableStatus.READY_TO_SERVE;
    }

    if (statuses.some((status) => status === OrderItemStatus.SENT || status === OrderItemStatus.PREPARING)) {
      return TableStatus.WAITING_KITCHEN;
    }

    return TableStatus.OCCUPIED;
  }

  private async ensureJoinableTables(joinedTableIds: string[], mainTableId: string, waiterId: string) {
    const uniqueIds = [...new Set(joinedTableIds)].filter((id) => id !== mainTableId);

    if (uniqueIds.length === 0) {
      return [];
    }

    const tables = await this.prisma.restaurantTable.findMany({
      where: { id: { in: uniqueIds }, isActive: true }
    });

    if (tables.length !== uniqueIds.length) {
      throw new NotFoundException('One or more joined tables were not found');
    }

    const blockedTable = tables.find(
      (table) => table.status !== TableStatus.AVAILABLE || (table.assignedWaiterId && table.assignedWaiterId !== waiterId)
    );

    if (blockedTable) {
      throw new ConflictException('Only available unassigned tables can be joined');
    }

    return tables;
  }

  private ensureOrderEditable(status: OrderStatus) {
    if (status === OrderStatus.WAITING_PAYMENT) {
      throw new ConflictException('La cuenta ya fue enviada a caja. No se pueden adicionar productos.');
    }

    if (status === OrderStatus.CLOSED || status === OrderStatus.CANCELLED || status === OrderStatus.PAID) {
      throw new ConflictException('Closed or cancelled orders cannot be edited');
    }
  }

  private async ensureMenuItemAvailable(menuItemId: string) {
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id: menuItemId }
    });

    if (!menuItem || !menuItem.isActive || !menuItem.isAvailable || !menuItem.showForWaiters) {
      throw new NotFoundException('Available menu item not found');
    }

    return menuItem;
  }

  private async ensureOrderItem(orderId: string, itemId: string) {
    const item = await this.prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId
      },
      include: {
        modifiers: true
      }
    });

    if (!item) {
      throw new NotFoundException('Order item not found');
    }

    return item;
  }

  private ensureCorrectionAllowed(sentCorrection: boolean, reason: string | undefined, user: AuthUser) {
    if (!sentCorrection) {
      return;
    }

    if (!managerRoles.has(user.role)) {
      throw new ForbiddenException('Corrections after kitchen send require manager permission');
    }

    if (!reason?.trim()) {
      throw new ConflictException('Corrections after kitchen send require a reason');
    }
  }

  private async getStringSetting(key: string, fallback: string) {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key }
    });

    return setting?.isActive ? setting.value : fallback;
  }

  private async getAfterPaymentTableStatus() {
    const configuredStatus = await this.getStringSetting('afterPaymentTableStatus', '');
    const legacyStatus = configuredStatus || (await this.getStringSetting('table_status_after_payment', TableStatus.CLEANING));
    const allowedStatuses = new Set<string>([TableStatus.AVAILABLE, TableStatus.CLEANING]);

    return allowedStatuses.has(legacyStatus) ? (legacyStatus as Extract<TableStatus, 'AVAILABLE' | 'CLEANING'>) : TableStatus.CLEANING;
  }

  private async buildModifierPayload(menuItemId: string, modifiers: AddOrderItemModifierDto[]) {
    if (modifiers.length === 0) {
      return [];
    }

    const modifierIds = modifiers.map((modifier) => modifier.modifierId);
    const records = await this.prisma.menuItemModifier.findMany({
      where: {
        id: { in: modifierIds },
        menuItemId,
        isActive: true
      }
    });

    if (records.length !== new Set(modifierIds).size) {
      throw new BadRequestException('El adicional seleccionado no aplica para este producto.');
    }

    return modifiers.map((modifier) => {
      const record = records.find((item) => item.id === modifier.modifierId);

      if (!record) {
        throw new BadRequestException('El adicional seleccionado no aplica para este producto.');
      }

      return {
        menuItemModifierId: record.id,
        nameSnapshot: record.name,
        quantity: modifier.quantity ?? 1,
        priceDelta: record.priceDelta
      };
    });
  }

  private calculateItemTotal(
    unitPrice: number,
    quantity: number,
    modifiers: Array<{ priceDelta: Prisma.Decimal | number; quantity: number }>
  ) {
    const modifierTotal = modifiers.reduce((sum, modifier) => sum + Number(modifier.priceDelta) * modifier.quantity, 0);
    return new Prisma.Decimal((unitPrice + modifierTotal) * quantity);
  }

  private async recalculateAndReturn(orderId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        orderId,
        status: { not: OrderItemStatus.CANCELLED }
      }
    });

    const subtotal = items.reduce((sum, item) => sum + Number(item.total), 0);

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        total: subtotal
      },
      include: orderInclude
    });
  }

  private createOrderNumber() {
    return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
}
