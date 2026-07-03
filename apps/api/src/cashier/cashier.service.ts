import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CashRegisterStatus, DiscountType, KitchenTicketStatus, OrderItemStatus, OrderStatus, PaymentMethod, Prisma, TableStatus, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import type { AddOrderItemDto, AddOrderItemModifierDto } from '../orders/dto/add-order-item.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { ApplyDiscountDto } from './dto/apply-discount.dto';
import type { CloseCashRegisterDto } from './dto/close-cash-register.dto';
import type { OpenCashRegisterDto } from './dto/open-cash-register.dto';
import type { PaymentLineDto, RegisterPaymentDto } from './dto/register-payment.dto';
import type { UpdateDiscountDto } from './dto/update-discount.dto';

const CASHIER_ORDER_STATUSES = [
  OrderStatus.OPEN,
  OrderStatus.SENT_TO_KITCHEN,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
  OrderStatus.WAITING_PAYMENT
];

const cashierOrderInclude = {
  _count: false,
  table: {
    select: {
      id: true,
      name: true,
      number: true,
      capacity: true,
      status: true,
      diningArea: {
        select: {
          name: true
        }
      }
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
  customer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true
    }
  },
  items: {
    include: {
      menuItem: {
        select: {
          id: true,
          name: true
        }
      },
      modifiers: true
    },
    orderBy: { createdAt: 'asc' }
  },
  discounts: {
    orderBy: { createdAt: 'desc' }
  },
  payments: {
    orderBy: { createdAt: 'asc' }
  }
} satisfies Prisma.OrderInclude;

const discountManagerRoles = new Set<UserRole>([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]);

@Injectable()
export class CashierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async openOrders() {
    const orders = await this.prisma.order.findMany({
      where: { status: { in: CASHIER_ORDER_STATUSES } },
      include: cashierOrderInclude,
      orderBy: { createdAt: 'desc' }
    });

    return this.attachReservationsToOrders(await Promise.all(orders.map((order) => this.updateOrderFinancials(order.id))));
  }

  async pendingTables() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: { notIn: [OrderStatus.PAID, OrderStatus.CLOSED, OrderStatus.CANCELLED] },
        OR: [
          { status: OrderStatus.WAITING_PAYMENT },
          { table: { status: TableStatus.WAITING_PAYMENT } }
        ]
      },
      include: cashierOrderInclude,
      orderBy: { createdAt: 'desc' }
    });

    return this.attachReservationsToOrders(await Promise.all(orders.map((order) => this.updateOrderFinancials(order.id))));
  }

  async reservedTablesOverview() {
    const tables = await this.prisma.restaurantTable.findMany({
      where: {
        isActive: true,
        status: TableStatus.RESERVED
      },
      select: {
        id: true,
        name: true,
        number: true,
        capacity: true,
        status: true,
        diningArea: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ number: 'asc' }]
    });

    return this.attachReservationDetails(tables);
  }

  async reservableTablesOverview() {
    const tables = await this.prisma.restaurantTable.findMany({
      where: {
        isActive: true,
        status: { in: [TableStatus.AVAILABLE, TableStatus.RESERVED] }
      },
      select: {
        id: true,
        name: true,
        number: true,
        capacity: true,
        status: true,
        diningArea: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ number: 'asc' }]
    });

    return this.attachReservationDetails(tables);
  }

  async reserveTableFromCashier(dto: {
    tableId: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    guestCount?: number;
    depositAmount?: number;
    reservationDate?: string;
    notes?: string;
  }, actor: AuthUser) {
    if (!dto.tableId || !dto.firstName?.trim()) {
      throw new BadRequestException('Selecciona una mesa y registra el nombre del cliente.');
    }

    const table = await this.prisma.restaurantTable.findUnique({ where: { id: dto.tableId } });

    if (!table || !table.isActive) {
      throw new NotFoundException('Mesa no encontrada.');
    }

    if (table.status !== TableStatus.AVAILABLE && table.status !== TableStatus.RESERVED) {
      throw new ConflictException('Solo se pueden reservar mesas disponibles o ya reservadas.');
    }

    const reservationNote = [
      `Reserva caja mesa ${table.number}`,
      dto.reservationDate ? `Fecha: ${dto.reservationDate}` : '',
      dto.guestCount ? `Personas: ${dto.guestCount}` : '',
      dto.depositAmount ? `Abono: ${dto.depositAmount}` : 'Abono: 0',
      dto.notes ? `Nota: ${dto.notes}` : ''
    ].filter(Boolean).join(' | ');

    const result = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          email: dto.email,
          notes: reservationNote
        }
      });

      const reservedTable = await tx.restaurantTable.update({
        where: { id: dto.tableId },
        data: { status: TableStatus.RESERVED },
        select: {
          id: true,
          name: true,
          number: true,
          capacity: true,
          status: true,
          diningArea: { select: { name: true } }
        }
      });

      return { customer, table: reservedTable };
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'cashier.table.reserve',
      entity: 'RestaurantTable',
      entityId: dto.tableId,
      before: { status: table.status },
      after: { status: TableStatus.RESERVED, customerId: result.customer.id },
      metadata: { reservationNote, depositAmount: dto.depositAmount ?? 0 }
    });

    return result;
  }

  private async attachReservationDetails(tables: Array<{ number: string } & Record<string, any>>): Promise<any[]> {
    if (tables.length === 0) {
      return [];
    }

    const customers = await this.prisma.customer.findMany({
      where: {
        isActive: true,
        notes: { contains: 'Reserva caja mesa' }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        notes: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return tables.map((table) => {
      const customer = customers.find((item) => item.notes?.split('|')[0]?.trim() === `Reserva caja mesa ${table.number}`);
      const reservation = customer ? this.parseReservationCustomer(customer) : null;

      return { ...table, reservation };
    });
  }

  private parseReservationCustomer(customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
    createdAt: Date;
  }) {
    const parts = (customer.notes ?? '').split('|').map((part) => part.trim());
    const readValue = (label: string) => {
      const part = parts.find((item) => item.startsWith(`${label}:`));
      return part ? part.slice(label.length + 1).trim() : '';
    };

    return {
      customerId: customer.id,
      customerName: [customer.firstName, customer.lastName].filter(Boolean).join(' '),
      depositAmount: Number(readValue('Abono') || 0),
      email: customer.email,
      guestCount: Number(readValue('Personas') || 0) || null,
      notes: readValue('Nota'),
      phone: customer.phone,
      registeredAt: customer.createdAt,
      reservationDate: readValue('Fecha')
    };
  }

  private async attachReservationsToOrders(orders: Array<{ table: { number: string } } & Record<string, any>>): Promise<any[]> {
    if (orders.length === 0) {
      return [];
    }

    const tables = orders.map((order) => order.table);
    const tablesWithReservations = await this.attachReservationDetails(tables);

    return orders.map((order) => {
      const tableWithReservation = tablesWithReservations.find((table) => table.number === order.table.number);

      return {
        ...order,
        table: {
          ...order.table,
          reservation: tableWithReservation?.reservation ?? null
        }
      };
    });
  }

  private async reservationForTableNumber(tableNumber: string) {
    const [table] = await this.attachReservationDetails([{ number: tableNumber }]);

    return table?.reservation ?? null;
  }

  private activeReservationDiscount(order: { discounts?: Array<{ isActive: boolean; name: string; type: DiscountType; value: Prisma.Decimal | number | string }> }, subtotal: number) {
    return (order.discounts ?? [])
      .filter((discount) => discount.isActive && discount.name === 'Abono reserva')
      .reduce((sum, discount) => sum + this.calculateDiscountAmount(subtotal, discount.type, Number(discount.value)), 0);
  }

  async findCashierConfig() {
    const [
      taxRate,
      suggestedTipRate,
      requireOpenCashRegister,
      allowMixedPayments,
      allowSplitBill,
      printReceiptAfterPayment,
      showTipOnReceipt,
      allowCustomTip,
      allowCashierRequestPayment,
      afterPaymentTableStatus
    ] = await Promise.all([
      this.getNumericSetting('default_tax_rate', 0),
      this.getNumericSetting('suggested_tip_rate', 10),
      this.getBooleanSetting('require_open_cash_register', true),
      this.getBooleanSetting('allow_mixed_payments', true),
      this.getBooleanSetting('allow_split_bill', true),
      this.getBooleanSetting('print_receipt_after_payment', true),
      this.getBooleanSetting('show_tip_on_receipt', true),
      this.getBooleanSetting('allow_custom_tip', true),
      this.getBooleanSetting('allow_cashier_request_payment', false),
      this.getAfterPaymentTableStatus()
    ]);

    return {
      taxRate,
      suggestedTipRate,
      tipSuggestions: [0, 5, 10],
      requireOpenCashRegister,
      allowMixedPayments,
      allowSplitBill,
      printReceiptAfterPayment,
      showTipOnReceipt,
      allowCustomTip,
      allowCashierRequestPayment,
      afterPaymentTableStatus
    };
  }

  findCurrentCashRegister(actor: AuthUser) {
    return this.prisma.cashRegister.findFirst({
      where: {
        openedById: actor.id,
        status: CashRegisterStatus.OPEN
      },
      include: {
        openedBy: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        payments: true
      },
      orderBy: { openedAt: 'desc' }
    });
  }

  async findRequiredCurrentCashRegister(actor: AuthUser) {
    const cashRegister = await this.findCurrentCashRegister(actor);

    if (!cashRegister) {
      throw new ConflictException('Debes abrir caja antes de cobrar.');
    }

    return cashRegister;
  }

  async cashRegisterSummary(id: string) {
    const cashRegister = await this.ensureCashRegister(id);
    const payments = await this.prisma.payment.findMany({
      where: { cashRegisterId: id },
      include: {
        order: {
          select: {
            id: true,
            subtotal: true,
            discountTotal: true,
            taxTotal: true,
            tipTotal: true,
            total: true
          }
        }
      }
    });

    const totalByMethod = (method: PaymentMethod) =>
      payments.filter((payment) => payment.method === method).reduce((sum, payment) => sum + Number(payment.amount), 0);
    const uniqueOrders = new Map(payments.map((payment) => [payment.order.id, payment.order]));
    const discountsTotal = Array.from(uniqueOrders.values()).reduce((sum, order) => sum + Number(order.discountTotal), 0);
    const tipsTotal = Array.from(uniqueOrders.values()).reduce((sum, order) => sum + Number(order.tipTotal), 0);
    const salesTotal = Array.from(uniqueOrders.values()).reduce((sum, order) => sum + Number(order.total), 0);
    const paymentsTotal = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const expectedCash = Number(cashRegister.openingAmount) + totalByMethod(PaymentMethod.CASH);

    return {
      cashRegister,
      totals: {
        cash: totalByMethod(PaymentMethod.CASH),
        card: totalByMethod(PaymentMethod.CARD),
        transfer: totalByMethod(PaymentMethod.TRANSFER),
        qr: totalByMethod(PaymentMethod.QR),
        tips: tipsTotal,
        discounts: discountsTotal,
        sales: salesTotal,
        payments: paymentsTotal,
        expectedCash
      }
    };
  }

  findDiscounts() {
    return this.prisma.discount.findMany({
      where: { orderId: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createDiscount(dto: ApplyDiscountDto, actor: AuthUser) {
    const discount = await this.prisma.discount.create({
      data: {
        name: dto.name,
        type: dto.type,
        value: dto.value,
        description: dto.reason
      }
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'admin.discount.create',
      entity: 'Discount',
      entityId: discount.id,
      after: discount
    });

    return discount;
  }

  async updateDiscount(id: string, dto: UpdateDiscountDto, actor: AuthUser) {
    const current = await this.findAdminDiscount(id);
    const discount = await this.prisma.discount.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        value: dto.value,
        description: dto.reason,
        isActive: dto.isActive
      }
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'admin.discount.update',
      entity: 'Discount',
      entityId: discount.id,
      before: current,
      after: discount
    });

    return discount;
  }

  async deactivateDiscount(id: string, actor: AuthUser) {
    const current = await this.findAdminDiscount(id);
    const discount = await this.prisma.discount.update({
      where: { id },
      data: { isActive: false }
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'admin.discount.deactivate',
      entity: 'Discount',
      entityId: discount.id,
      before: current,
      after: discount
    });

    return discount;
  }

  async findOrder(orderId: string): Promise<any> {
    const order = await this.updateOrderFinancials(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async preInvoice(orderId: string) {
    const order = await this.findOrder(orderId);

    return {
      data: {
        order,
        totals: this.invoiceTotals(order)
      },
      message: 'Cuenta previa generada correctamente.'
    };
  }

  async finalReceipt(orderId: string) {
    const order = await this.findOrder(orderId);

    if (order.status !== OrderStatus.PAID) {
      throw new ConflictException('The order must be paid before generating final receipt');
    }

    return {
      data: {
        order,
        totals: this.invoiceTotals(order)
      },
      message: 'Factura final generada correctamente.'
    };
  }

  async openCashRegister(dto: OpenCashRegisterDto, actor: AuthUser) {
    const alreadyOpen = await this.prisma.cashRegister.findFirst({
      where: {
        openedById: actor.id,
        status: CashRegisterStatus.OPEN
      }
    });

    if (alreadyOpen) {
      throw new ConflictException('Cash register is already open for this user');
    }

    const cashRegister = await this.prisma.cashRegister.create({
      data: {
        name: dto.name ?? 'Caja principal',
        openedById: actor.id,
        openingAmount: dto.openingAmount,
        status: CashRegisterStatus.OPEN
      }
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'cashier.cash-register.open',
      entity: 'CashRegister',
      entityId: cashRegister.id,
      after: { ...cashRegister, notes: dto.notes }
    });

    return cashRegister;
  }

  async closeCurrentCashRegister(dto: CloseCashRegisterDto, actor: AuthUser) {
    const cashRegister = await this.findRequiredCurrentCashRegister(actor);

    return this.closeCashRegister(cashRegister.id, dto, actor);
  }

  async closeCashRegister(id: string, dto: CloseCashRegisterDto, actor: AuthUser) {
    const current = await this.ensureCashRegister(id);

    if (current.status !== CashRegisterStatus.OPEN) {
      throw new ConflictException('Cash register is not open');
    }

    const summary = await this.cashRegisterSummary(id);
    const expectedAmount = summary.totals.expectedCash;
    const cashRegister = await this.prisma.cashRegister.update({
      where: { id },
      data: {
        closedById: actor.id,
        closingAmount: dto.closingAmount,
        expectedAmount,
        closedAt: new Date(),
        status: CashRegisterStatus.CLOSED
      }
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'cashier.cash-register.close',
      entity: 'CashRegister',
      entityId: id,
      before: current,
      after: { ...cashRegister, notes: dto.notes }
    });

    return cashRegister;
  }

  async applyDiscount(orderId: string, dto: ApplyDiscountDto, actor: AuthUser) {
    const order = await this.findOrder(orderId);
    const normalizedDiscount = this.normalizeDiscountInput(dto.type, dto.value);
    const discountAmount = this.calculateDiscountAmount(Number(order.subtotal), normalizedDiscount.type, normalizedDiscount.value);

    await this.ensureDiscountAllowed(actor.role, normalizedDiscount.type, normalizedDiscount.value, discountAmount);

    const result = await this.prisma.$transaction(async (tx) => {
      const discount = await tx.discount.create({
        data: {
          orderId,
          name: dto.name,
          type: normalizedDiscount.type,
          value: normalizedDiscount.value,
          description: dto.reason
        }
      });

      const discounts = await tx.discount.findMany({
        where: {
          orderId,
          isActive: true
        }
      });
      const discountTotal = discounts.reduce(
        (sum, discountItem) => sum + this.calculateDiscountAmount(Number(order.subtotal), discountItem.type, Number(discountItem.value)),
        0
      );

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: await this.buildFinancialUpdate(Number(order.subtotal), discountTotal, Number(order.tipTotal)),
        include: cashierOrderInclude
      });

      return { discount, updatedOrder };
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'cashier.discount.apply',
      entity: 'Discount',
      entityId: result.discount.id,
      before: order,
      after: result.discount,
      metadata: { reason: dto.reason, discountAmount }
    });

    return (await this.attachReservationsToOrders([result.updatedOrder]))[0];
  }

  async requestPaymentFromCashier(orderId: string, actor: AuthUser) {
    return this.markWaitingPaymentOrder(orderId, actor, 'cashier.order.request-payment');
  }

  async addLastMinuteItem(orderId: string, dto: AddOrderItemDto, actor: AuthUser) {
    const order = await this.findOrder(orderId);

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Esta cuenta ya no permite adicionar productos.');
    }

    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: dto.menuItemId } });

    if (!menuItem || !menuItem.isActive || !menuItem.isAvailable) {
      throw new NotFoundException('Producto disponible no encontrado.');
    }

    const modifierPayload = await this.buildLastMinuteModifierPayload(dto.menuItemId, dto.modifiers ?? []);
    const modifierTotal = modifierPayload.reduce((sum, modifier) => sum + Number(modifier.priceDelta) * modifier.quantity, 0);
    const lineTotal = new Prisma.Decimal((Number(menuItem.price) + modifierTotal) * dto.quantity);

    await this.prisma.orderItem.create({
      data: {
        orderId,
        menuItemId: dto.menuItemId,
        quantity: dto.quantity,
        unitPrice: menuItem.price,
        total: lineTotal,
        status: OrderItemStatus.SERVED,
        notes: dto.notes ? `Agregado en caja: ${dto.notes}` : 'Agregado en caja antes del cobro',
        modifiers: { create: modifierPayload }
      }
    });

    const items = await this.prisma.orderItem.findMany({
      where: { orderId, status: { not: OrderItemStatus.CANCELLED } }
    });
    const subtotal = items.reduce((sum, item) => sum + Number(item.total), 0);

    await this.prisma.order.update({
      where: { id: orderId },
      data: { subtotal: new Prisma.Decimal(subtotal) }
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'cashier.order.add-last-minute-item',
      entity: 'Order',
      entityId: orderId,
      after: { menuItemId: dto.menuItemId, quantity: dto.quantity, total: lineTotal },
      metadata: { source: 'cashier' }
    });

    return this.updateOrderFinancials(orderId);
  }

  async releaseEmptyOrder(orderId: string, reason: string, actor: AuthUser) {
    const order = await this.findOrder(orderId);
    const activeItems = order.items.filter((item: any) => item.status !== OrderItemStatus.CANCELLED);

    if (activeItems.length > 0) {
      throw new ConflictException('Esta mesa tiene productos registrados. Debe cobrarse o cancelarse con autorizacion.');
    }

    if (!reason?.trim()) {
      throw new ConflictException('Debes registrar una nota para liberar una mesa sin consumo.');
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: TableStatus.AVAILABLE }
      });

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason
        },
        include: cashierOrderInclude
      });
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'cashier.order.release-empty',
      entity: 'Order',
      entityId: orderId,
      before: { status: order.status, tableStatus: order.table.status },
      after: { status: OrderStatus.CANCELLED, tableStatus: TableStatus.AVAILABLE },
      metadata: { reason }
    });

    return updatedOrder;
  }

  async cancelAuthorizedOrder(orderId: string, reason: string, authorizedBy: string, actor: AuthUser) {
    const order = await this.findOrder(orderId);

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Esta factura o pedido ya no se puede eliminar desde caja.');
    }

    if (!reason?.trim()) {
      throw new ConflictException('Debes registrar el motivo para eliminar el pedido.');
    }

    if (!authorizedBy?.trim()) {
      throw new ConflictException('Debes registrar el nombre de quien autoriza la eliminacion.');
    }

    const activeItems = order.items.filter((item: any) => item.status !== OrderItemStatus.CANCELLED);
    const cancelledAt = new Date();
    const cancellationReason = `Caja autorizada por ${authorizedBy.trim()}: ${reason.trim()}`;

    const cancelledOrder = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: {
          orderId,
          status: { not: OrderItemStatus.CANCELLED }
        },
        data: {
          cancelledAt,
          status: OrderItemStatus.CANCELLED
        }
      });

      await tx.kitchenTicket.updateMany({
        where: { orderId },
        data: { status: KitchenTicketStatus.CANCELLED }
      });

      await tx.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: TableStatus.AVAILABLE }
      });

      return tx.order.update({
        where: { id: orderId },
        data: {
          cancelledAt,
          cancellationReason,
          status: OrderStatus.CANCELLED
        },
        include: cashierOrderInclude
      });
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'cashier.order.cancel-authorized',
      entity: 'Order',
      entityId: orderId,
      before: { status: order.status, tableStatus: order.table.status },
      after: {
        authorizedBy: authorizedBy.trim(),
        cancelledItemIds: activeItems.map((item: any) => item.id),
        reason: reason.trim(),
        status: OrderStatus.CANCELLED,
        tableStatus: TableStatus.AVAILABLE
      }
    });

    return cancelledOrder;
  }

  async markWaitingPaymentFromCashier(orderId: string, actor: AuthUser) {
    const order = await this.markWaitingPaymentOrder(orderId, actor, 'MARK_WAITING_PAYMENT_FROM_CASHIER');

    return {
      message: 'Orden enviada a cuenta correctamente.',
      order,
      table: order.table
    };
  }

  private async markWaitingPaymentOrder(orderId: string, actor: AuthUser, auditAction: string) {
    const isAllowedByConfig = await this.getBooleanSetting('allow_cashier_request_payment', false);

    if (!isAllowedByConfig) {
      throw new ConflictException('La configuracion no permite pasar cuentas a cobro desde caja.');
    }

    const order = await this.findOrder(orderId);

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Esta cuenta ya fue pagada.');
    }

    if (order.status === OrderStatus.WAITING_PAYMENT || order.table.status === TableStatus.WAITING_PAYMENT) {
      return order;
    }

    const allowedStatuses = new Set<OrderStatus>([
      OrderStatus.OPEN,
      OrderStatus.SENT,
      OrderStatus.SENT_TO_KITCHEN,
      OrderStatus.IN_PROGRESS,
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.SERVED
    ]);

    if (!allowedStatuses.has(order.status)) {
      throw new ConflictException('La orden no puede pasar a cobro desde su estado actual.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.WAITING_PAYMENT }
      });

      await tx.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: TableStatus.WAITING_PAYMENT }
      });

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: auditAction,
          entity: 'Order',
          entityId: orderId,
          before: { status: order.status, tableStatus: order.table.status },
          after: { status: OrderStatus.WAITING_PAYMENT, tableStatus: TableStatus.WAITING_PAYMENT },
          metadata: { reason: 'Cuenta enviada a cobro desde caja.' }
        }
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: cashierOrderInclude
      });
    });
  }

  async registerPayment(orderId: string, dto: RegisterPaymentDto, actor: AuthUser) {
    const order = await this.findOrder(orderId);

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Order cannot receive more payments');
    }

    if (order.status !== OrderStatus.WAITING_PAYMENT) {
      throw new ConflictException('The order must be waiting for payment before charging');
    }

    const paymentLines = this.normalizePaymentLines(dto);
    const requireOpenRegister = await this.getBooleanSetting('require_open_cash_register', true);

    if (requireOpenRegister && !dto.cashRegisterId) {
      throw new ConflictException('Debes abrir caja antes de cobrar.');
    }

    await this.ensureCashRegisterCanReceive(dto.cashRegisterId);

    const result = await this.prisma.$transaction(async (tx) => {
      const tipTotal = Number(order.tipTotal) + Number(dto.tipAmount ?? 0);
      const financialUpdate = await this.buildFinancialUpdate(Number(order.subtotal), Number(order.discountTotal), tipTotal);
      const nextTotal = Number(financialUpdate.total);

      if (dto.tipAmount !== undefined) {
        await tx.order.update({
          where: { id: orderId },
          data: financialUpdate
        });
      }

      const createdPayments = await Promise.all(paymentLines.map((payment) => tx.payment.create({
        data: {
          orderId,
          cashRegisterId: dto.cashRegisterId,
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference
        }
      })));

      const existingPayments = await tx.payment.findMany({ where: { orderId } });
      const paidTotal = existingPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const isFullyPaid = paidTotal >= nextTotal;

      if (isFullyPaid) {
        const closeTableStatus = TableStatus.AVAILABLE;

        await tx.order.update({
          where: { id: orderId },
          data: { closedAt: new Date(), status: OrderStatus.PAID }
        });

        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: closeTableStatus }
        });

        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'cashier.order.close',
            entity: 'Order',
            entityId: orderId,
            before: { status: order.status, closedAt: order.closedAt },
            after: { status: OrderStatus.PAID, closedAt: new Date().toISOString() },
            metadata: { reason: 'Pago completo registrado en caja.' }
          }
        });

        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'cashier.table.release',
            entity: 'RestaurantTable',
            entityId: order.tableId,
            before: { status: order.table.status },
            after: { status: closeTableStatus },
            metadata: { orderId, reason: 'Mesa liberada por pago completo.' }
          }
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'cashier.payment.register',
          entity: 'Order',
          entityId: orderId,
          before: {
            paidTotalBefore: order.payments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0),
            status: order.status,
            tipTotal: Number(order.tipTotal),
            total: Number(order.total)
          },
          after: {
            isFullyPaid,
            paidTotal,
            payments: createdPayments.map((payment) => ({
              id: payment.id,
              amount: Number(payment.amount),
              method: payment.method,
              reference: payment.reference ?? null
            })),
            tipAmount: dto.tipAmount ?? 0,
            total: nextTotal
          },
          metadata: { cashRegisterId: dto.cashRegisterId ?? null }
        }
      });

      return {
        paidTotal,
        isFullyPaid,
        order: await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: cashierOrderInclude
        })
      };
    });

    return result.order;
  }

  async checkoutOrder(orderId: string, dto: RegisterPaymentDto, actor: AuthUser) {
    const order = await this.findOrder(orderId);

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Esta cuenta ya fue pagada.');
    }

    const isPaymentRequested = order.status === OrderStatus.WAITING_PAYMENT || order.table.status === TableStatus.WAITING_PAYMENT;

    if (!isPaymentRequested) {
      throw new ForbiddenException('La cuenta aun no fue solicitada por el mesero.');
    }

    if (order.items.length === 0) {
      throw new ConflictException('No se puede cobrar una orden vacia.');
    }

    const tipAmount = Number(dto.tipAmount ?? order.tipTotal ?? 0);

    if (!Number.isFinite(tipAmount) || tipAmount < 0) {
      throw new BadRequestException('La propina no es valida.');
    }

    const requireOpenRegister = await this.getBooleanSetting('require_open_cash_register', true);
    const cashRegister = dto.cashRegisterId ? await this.ensureCashRegister(dto.cashRegisterId) : await this.findCurrentCashRegister(actor);

    if (requireOpenRegister && !cashRegister) {
      throw new ConflictException('Debes abrir caja antes de cobrar.');
    }

    if (cashRegister && cashRegister.status !== CashRegisterStatus.OPEN) {
      throw new ConflictException('Debes abrir caja antes de cobrar.');
    }

    const recalculatedSubtotal = order.items.reduce((sum: number, item: any) => sum + Number(item.total), 0);
    const activeDiscountTotal = order.discounts
      .filter((discount: any) => discount.isActive)
      .reduce((sum: number, discount: any) => sum + this.calculateDiscountAmount(recalculatedSubtotal, discount.type, Number(discount.value)), 0);
    const reservation = await this.reservationForTableNumber(order.table.number);
    const existingReservationDiscountAmount = this.activeReservationDiscount(order, recalculatedSubtotal);
    const reservationDepositAmount = Math.max(0, Number(reservation?.depositAmount ?? 0));
    const checkoutDiscount = dto.discount?.type && Number(dto.discount.value ?? 0) > 0
      ? this.normalizeDiscountInput(dto.discount.type, Number(dto.discount.value ?? 0))
      : null;
    const checkoutDiscountAmount = checkoutDiscount
      ? this.calculateDiscountAmount(recalculatedSubtotal, checkoutDiscount.type, checkoutDiscount.value)
      : 0;

    if (checkoutDiscount) {
      await this.ensureDiscountAllowed(actor.role, checkoutDiscount.type, checkoutDiscount.value, checkoutDiscountAmount);
    }

    const reservationDiscountAmount = existingReservationDiscountAmount > 0
      ? 0
      : Math.min(reservationDepositAmount, Math.max(0, recalculatedSubtotal - activeDiscountTotal - checkoutDiscountAmount));
    const discountTotal = activeDiscountTotal + checkoutDiscountAmount + reservationDiscountAmount;

    if (discountTotal > recalculatedSubtotal) {
      throw new BadRequestException('El descuento no puede ser mayor al total.');
    }

    const existingPaidTotal = order.payments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
    const financialUpdate = await this.buildFinancialUpdate(recalculatedSubtotal, discountTotal, tipAmount);
    const totalFinal = Number(financialUpdate.total);
    const amountDue = Math.max(0, totalFinal - existingPaidTotal);
    const checkoutPayments = amountDue > 0 ? this.normalizeCheckoutPaymentLines(dto, amountDue) : [];
    const paymentTotal = checkoutPayments.reduce((sum, payment) => sum + payment.amount, 0);

    if (Math.abs(paymentTotal - amountDue) > 0.01) {
      throw new ConflictException('La suma de los pagos no coincide con el total.');
    }

    const closeTableStatus = TableStatus.AVAILABLE;

    const result = await this.prisma.$transaction(async (tx) => {
      const closedAt = new Date();

      if (order.status !== OrderStatus.WAITING_PAYMENT || order.table.status !== TableStatus.WAITING_PAYMENT) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.WAITING_PAYMENT }
        });

        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: TableStatus.WAITING_PAYMENT }
        });

        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'cashier.order.sync-waiting-payment',
            entity: 'Order',
            entityId: orderId,
            before: { status: order.status, tableStatus: order.table.status },
            after: { status: OrderStatus.WAITING_PAYMENT, tableStatus: TableStatus.WAITING_PAYMENT },
            metadata: { reason: 'Sincronizacion de cuenta ya solicitada antes de cobrar.' }
          }
        });
      }

      let checkoutDiscountRecord: { id: string } | null = null;
      let reservationDiscountRecord: { id: string } | null = null;

      if (checkoutDiscount) {
        checkoutDiscountRecord = await tx.discount.create({
          data: {
            orderId,
            name: 'Descuento caja',
            type: checkoutDiscount.type,
            value: checkoutDiscount.value,
            description: 'Aplicado durante cierre de caja'
          },
          select: { id: true }
        });
      }

      if (reservationDiscountAmount > 0) {
        reservationDiscountRecord = await tx.discount.create({
          data: {
            orderId,
            name: 'Abono reserva',
            type: DiscountType.FIXED_AMOUNT,
            value: reservationDiscountAmount,
            description: `Saldo a favor de reserva${reservation?.customerName ? ` - ${reservation.customerName}` : ''}`
          },
          select: { id: true }
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          ...financialUpdate,
          subtotal: new Prisma.Decimal(recalculatedSubtotal)
        }
      });

      const createdPayments = await Promise.all(checkoutPayments.map((payment) => tx.payment.create({
        data: {
          orderId,
          cashRegisterId: cashRegister?.id,
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference
        }
      })));

      await tx.order.update({
        where: { id: orderId },
        data: { closedAt, status: OrderStatus.PAID }
      });

      await tx.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: closeTableStatus }
      });

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'cashier.payment.register',
          entity: 'Order',
          entityId: orderId,
          before: {
            paidTotalBefore: existingPaidTotal,
            status: order.status,
            tipTotal: Number(order.tipTotal),
            total: Number(order.total)
          },
          after: {
            paidTotal: existingPaidTotal + paymentTotal,
            payments: createdPayments.map((payment) => ({
              id: payment.id,
              amount: Number(payment.amount),
              method: payment.method,
              reference: payment.reference ?? null
            })),
            tipAmount,
            total: totalFinal
          },
          metadata: {
            amountDue,
            cashChange: checkoutPayments.reduce((sum, payment) => sum + (payment.cashChange ?? 0), 0),
            cashRegisterId: cashRegister?.id ?? null,
            checkoutDiscountAmount,
            checkoutDiscountId: checkoutDiscountRecord?.id ?? null,
            reservationDepositAmount,
            reservationDiscountAmount,
            reservationDiscountId: reservationDiscountRecord?.id ?? null,
            paymentTotal
          }
        }
      });

      if (checkoutDiscountRecord) {
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'cashier.discount.apply',
            entity: 'Discount',
            entityId: checkoutDiscountRecord.id,
            before: { discountTotal: Number(order.discountTotal) },
            after: { discountAmount: checkoutDiscountAmount, discountTotal },
            metadata: { reason: 'Descuento aplicado durante checkout.' }
          }
        });
      }

      if (reservationDiscountRecord) {
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'cashier.reservation.deposit.apply',
            entity: 'Discount',
            entityId: reservationDiscountRecord.id,
            before: { reservationDepositAmount },
            after: { discountAmount: reservationDiscountAmount, discountTotal },
            metadata: { customerName: reservation?.customerName ?? null, tableNumber: order.table.number }
          }
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'cashier.order.close',
          entity: 'Order',
          entityId: orderId,
          before: { status: order.status, closedAt: order.closedAt },
          after: { status: OrderStatus.PAID, closedAt: closedAt.toISOString() },
          metadata: { reason: 'Pago completo registrado en caja.' }
        }
      });

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'cashier.table.release',
          entity: 'RestaurantTable',
          entityId: order.tableId,
          before: { status: order.table.status },
          after: { status: closeTableStatus },
          metadata: {
            orderId,
            reason: 'Mesa liberada por pago completo.'
          }
        }
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: cashierOrderInclude
      });
    });

    const receipt = {
      cashChange: checkoutPayments.reduce((sum, payment) => sum + (payment.cashChange ?? 0), 0),
      payments: checkoutPayments,
      totals: this.invoiceTotals(result)
    };

    return {
      data: {
        order: result,
        receipt,
        table: result.table
      },
      message: 'Pago registrado correctamente. Mesa liberada.',
      order: result,
      receipt,
      table: result.table
    };
  }

  private normalizePaymentLines(dto: RegisterPaymentDto): PaymentLineDto[] {
    if (dto.payments?.length) {
      return dto.payments;
    }

    if (!dto.method || !dto.amount) {
      throw new ConflictException('Payment method and amount are required');
    }

    if (dto.method === PaymentMethod.MIXED) {
      throw new ConflictException('Mixed payments require payment lines');
    }

    return [{ method: dto.method, amount: dto.amount, reference: dto.reference }];
  }

  private normalizeCheckoutPaymentLines(dto: RegisterPaymentDto, amountDue: number): Array<PaymentLineDto & { cashChange?: number }> {
    if (amountDue <= 0) {
      throw new ConflictException('Esta cuenta ya fue pagada.');
    }

    if (dto.payments?.length) {
      const payments: Array<PaymentLineDto & { cashChange?: number }> = dto.payments.map((payment) => {
        if (payment.method === PaymentMethod.MIXED) {
          throw new ConflictException('La suma de los pagos no coincide con el total.');
        }

        return { ...payment };
      });
      const paymentTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const overpaid = paymentTotal - amountDue;

      if (overpaid > 0.01) {
        const cashPaymentIndex = payments.findIndex((payment) => payment.method === PaymentMethod.CASH && payment.amount > 0);

        if (cashPaymentIndex < 0) {
          throw new ConflictException('La suma de los pagos no coincide con el total.');
        }

        const cashPayment = payments[cashPaymentIndex];

        if (cashPayment.amount - overpaid <= 0) {
          throw new ConflictException('La suma de los pagos no coincide con el total.');
        }

        payments[cashPaymentIndex] = {
          ...cashPayment,
          amount: cashPayment.amount - overpaid,
          cashChange: overpaid
        };
      }

      return payments;
    }

    if (!dto.method || !dto.amount) {
      throw new ConflictException('No se pudo registrar el pago. Intenta nuevamente.');
    }

    if (dto.method === PaymentMethod.MIXED) {
      throw new ConflictException('La suma de los pagos no coincide con el total.');
    }

    if (dto.method === PaymentMethod.CASH) {
      if (dto.amount < amountDue) {
        throw new ConflictException('La suma de los pagos no coincide con el total.');
      }

      return [
        {
          amount: amountDue,
          cashChange: dto.amount - amountDue,
          method: dto.method,
          reference: dto.reference
        }
      ];
    }

    if (Math.abs(dto.amount - amountDue) > 0.01) {
      throw new ConflictException('La suma de los pagos no coincide con el total.');
    }

    return [{ method: dto.method, amount: amountDue, reference: dto.reference }];
  }

  private invoiceTotals(order: {
    subtotal: Prisma.Decimal | number | string;
    discountTotal: Prisma.Decimal | number | string;
    taxTotal: Prisma.Decimal | number | string;
    tipTotal: Prisma.Decimal | number | string;
    total: Prisma.Decimal | number | string;
    payments: Array<{ amount: Prisma.Decimal | number | string }>;
  }) {
    const paidTotal = order.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const total = Number(order.total);

    return {
      balance: Math.max(0, total - paidTotal),
      discountTotal: Number(order.discountTotal),
      paidTotal,
      subtotal: Number(order.subtotal),
      taxTotal: Number(order.taxTotal),
      tipTotal: Number(order.tipTotal),
      total
    };
  }

  private calculateDiscountAmount(subtotal: number, type: DiscountType, value: number) {
    if (type === DiscountType.PERCENTAGE && value > 100) {
      return Math.min(subtotal, value);
    }

    if (type === DiscountType.PERCENTAGE) {
      return Math.min(subtotal, subtotal * (value / 100));
    }

    return Math.min(subtotal, value);
  }

  private normalizeDiscountInput(type: DiscountType, value: number) {
    if (type === DiscountType.PERCENTAGE && value > 100) {
      return { type: DiscountType.FIXED_AMOUNT, value };
    }

    return { type, value };
  }

  private async ensureDiscountAllowed(role: UserRole, type: DiscountType, value: number, discountAmount: number) {
    const percentageThreshold = await this.getNumericSetting('discount_manager_percent_threshold', 10);
    const amountThreshold = await this.getNumericSetting('discount_manager_amount_threshold', 50000);
    const requiresManager = type === DiscountType.PERCENTAGE ? value > percentageThreshold : discountAmount > amountThreshold;

    if (requiresManager && !discountManagerRoles.has(role)) {
      throw new ForbiddenException('No tienes permiso para aplicar descuentos.');
    }
  }

  private async buildLastMinuteModifierPayload(menuItemId: string, modifiers: AddOrderItemModifierDto[]) {
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

  private async updateOrderFinancials(orderId: string): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: cashierOrderInclude
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const discountTotal = order.discounts
      .filter((discount) => discount.isActive)
      .reduce((sum, discount) => sum + this.calculateDiscountAmount(Number(order.subtotal), discount.type, Number(discount.value)), 0);
    const financialUpdate = await this.buildFinancialUpdate(Number(order.subtotal), discountTotal, Number(order.tipTotal));

    if (
      Number(order.discountTotal) !== Number(financialUpdate.discountTotal) ||
      Number(order.taxTotal) !== Number(financialUpdate.taxTotal) ||
      Number(order.total) !== Number(financialUpdate.total)
    ) {
      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: financialUpdate,
        include: cashierOrderInclude
      });

      return (await this.attachReservationsToOrders([updatedOrder]))[0];
    }

    return (await this.attachReservationsToOrders([order]))[0];
  }

  private async buildFinancialUpdate(subtotal: number, discountTotal: number, tipTotal: number) {
    const taxRate = await this.getNumericSetting('default_tax_rate', 0);
    const taxableBase = Math.max(0, subtotal - discountTotal);
    const taxTotal = taxableBase * (taxRate / 100);

    return {
      discountTotal: new Prisma.Decimal(discountTotal),
      taxTotal: new Prisma.Decimal(taxTotal),
      tipTotal: new Prisma.Decimal(tipTotal),
      total: new Prisma.Decimal(Math.max(0, taxableBase + taxTotal + tipTotal))
    };
  }

  private async getNumericSetting(key: string, fallback: number) {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key }
    });
    const value = Number(setting?.isActive === false ? fallback : setting?.value ?? fallback);

    return Number.isFinite(value) ? value : fallback;
  }

  private async getBooleanSetting(key: string, fallback: boolean) {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key }
    });

    if (!setting || setting.isActive === false) {
      return fallback;
    }

    return setting.value === 'true';
  }

  private async getStringSetting(key: string, fallback: string) {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key }
    });

    if (!setting || setting.isActive === false) {
      return fallback;
    }

    return setting.value;
  }

  private async getAfterPaymentTableStatus() {
    const configuredStatus = await this.getStringSetting('afterPaymentTableStatus', '');
    const legacyStatus = configuredStatus || (await this.getStringSetting('table_status_after_payment', TableStatus.AVAILABLE));
    const allowedStatuses = new Set<string>([TableStatus.AVAILABLE, TableStatus.CLEANING]);

    return allowedStatuses.has(legacyStatus) ? (legacyStatus as Extract<TableStatus, 'AVAILABLE' | 'CLEANING'>) : TableStatus.AVAILABLE;
  }

  private async ensureCashRegister(id: string) {
    const cashRegister = await this.prisma.cashRegister.findUnique({ where: { id } });

    if (!cashRegister) {
      throw new NotFoundException('Cash register not found');
    }

    return cashRegister;
  }

  private async ensureCashRegisterCanReceive(id?: string) {
    if (!id) {
      return;
    }

    const cashRegister = await this.ensureCashRegister(id);

    if (cashRegister.status !== CashRegisterStatus.OPEN) {
      throw new ConflictException('Debes abrir caja antes de cobrar.');
    }
  }

  private async findAdminDiscount(id: string) {
    const discount = await this.prisma.discount.findFirst({
      where: {
        id,
        orderId: null
      }
    });

    if (!discount) {
      throw new NotFoundException('Discount not found');
    }

    return discount;
  }
}
