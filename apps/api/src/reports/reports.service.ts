import { Injectable } from '@nestjs/common';
import { OrderItemStatus, PaymentMethod } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

export interface ReportQuery {
  startDate?: string;
  endDate?: string;
  waiterId?: string;
  tableId?: string;
  paymentMethod?: PaymentMethod | 'Todos';
  categoryId?: string;
  reportType?: string;
}

export interface ReportRow {
  id: string;
  date: string;
  type: string;
  employee: string;
  employeeId?: string | null;
  table: string;
  tableId?: string | null;
  paymentMethod?: string | null;
  category: string;
  categoryId?: string | null;
  concept: string;
  quantity: number;
  amount: number;
}

interface CategoryReportItem {
  createdAt: Date;
  quantity: number;
  total: { toString(): string } | number | string;
  menuItem: {
    categoryId: string;
    category: {
      name: string;
    };
  };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async findReports(query: ReportQuery, user: AuthUser) {
    const range = this.dateRange(query);
    const [payments, orderItems, discounts, cancelledItems, lowStock, cashRegisters] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          paidAt: range,
          method: query.paymentMethod && query.paymentMethod !== 'Todos' ? query.paymentMethod : undefined,
          order: {
            waiterId: query.waiterId || undefined,
            tableId: query.tableId || undefined
          }
        },
        include: {
          order: {
            include: {
              table: true,
              waiter: true
            }
          }
        },
        orderBy: { paidAt: 'desc' }
      }),
      this.prisma.orderItem.findMany({
        where: {
          createdAt: range,
          status: { not: OrderItemStatus.CANCELLED },
          order: {
            waiterId: query.waiterId || undefined,
            tableId: query.tableId || undefined
          },
          menuItem: {
            categoryId: query.categoryId || undefined
          }
        },
        include: {
          order: { include: { table: true, waiter: true } },
          menuItem: { include: { category: true } }
        }
      }),
      this.prisma.discount.findMany({
        where: {
          orderId: { not: null },
          createdAt: range,
          order: {
            waiterId: query.waiterId || undefined,
            tableId: query.tableId || undefined
          }
        },
        include: {
          order: { include: { table: true, waiter: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.orderItem.findMany({
        where: {
          createdAt: range,
          status: OrderItemStatus.CANCELLED,
          order: {
            waiterId: query.waiterId || undefined,
            tableId: query.tableId || undefined
          },
          menuItem: {
            categoryId: query.categoryId || undefined
          }
        },
        include: {
          order: { include: { table: true, waiter: true } },
          menuItem: { include: { category: true } }
        }
      }),
      this.prisma.ingredient.findMany({
        where: {
          isActive: true,
          currentStock: { lte: this.prisma.ingredient.fields.minimumStock }
        },
        orderBy: { name: 'asc' }
      }),
      this.prisma.cashRegister.findMany({
        where: {
          createdAt: range
        },
        include: {
          openedBy: true,
          payments: true
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const rows: ReportRow[] = [
      ...payments.map((payment) => ({
        id: payment.id,
        date: this.formatDate(payment.paidAt),
        type: 'Venta',
        employee: this.userName(payment.order.waiter),
        employeeId: payment.order.waiterId,
        table: this.tableName(payment.order.table),
        tableId: payment.order.tableId,
        paymentMethod: payment.method,
        category: 'Pagos',
        concept: payment.order.orderNumber,
        quantity: 1,
        amount: Number(payment.amount)
      })),
      ...orderItems.map((item) => ({
        id: item.id,
        date: this.formatDate(item.createdAt),
        type: 'Producto vendido',
        employee: this.userName(item.order.waiter),
        employeeId: item.order.waiterId,
        table: this.tableName(item.order.table),
        tableId: item.order.tableId,
        category: item.menuItem.category.name,
        categoryId: item.menuItem.categoryId,
        concept: item.menuItem.name,
        quantity: item.quantity,
        amount: Number(item.total)
      })),
      ...this.categoryRows(orderItems),
      ...discounts.map((discount) => ({
        id: discount.id,
        date: this.formatDate(discount.createdAt),
        type: 'Descuento aplicado',
        employee: this.userName(discount.order?.waiter),
        employeeId: discount.order?.waiterId,
        table: discount.order?.table ? this.tableName(discount.order.table) : 'N/A',
        tableId: discount.order?.tableId,
        category: 'Descuentos',
        concept: discount.name,
        quantity: 1,
        amount: -Math.abs(this.discountAmount(Number(discount.order?.subtotal ?? 0), discount.type, Number(discount.value)))
      })),
      ...cancelledItems.map((item) => ({
        id: `cancel-${item.id}`,
        date: this.formatDate(item.updatedAt),
        type: 'Cancelacion',
        employee: this.userName(item.order.waiter),
        employeeId: item.order.waiterId,
        table: this.tableName(item.order.table),
        tableId: item.order.tableId,
        category: item.menuItem.category.name,
        categoryId: item.menuItem.categoryId,
        concept: item.menuItem.name,
        quantity: item.quantity,
        amount: -Math.abs(Number(item.total))
      })),
      ...lowStock.map((ingredient) => ({
        id: `low-${ingredient.id}`,
        date: this.formatDate(new Date()),
        type: 'Inventario bajo',
        employee: 'Sistema',
        table: 'N/A',
        category: 'Inventario',
        concept: ingredient.name,
        quantity: Number(ingredient.currentStock),
        amount: 0
      })),
      ...cashRegisters.map((register) => ({
        id: `cash-${register.id}`,
        date: this.formatDate(register.closedAt ?? register.createdAt),
        type: 'Cierre de caja',
        employee: this.userName(register.openedBy),
        employeeId: register.openedById,
        table: register.name,
        category: 'Caja',
        concept: register.status,
        quantity: register.payments.length,
        amount: register.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
      }))
    ].filter((row) => !query.reportType || query.reportType === 'Todos' || row.type === query.reportType);

    return {
      generatedAt: new Date().toISOString(),
      generatedBy: user.email,
      filters: query,
      summary: this.summary(rows),
      rows,
      options: await this.options()
    };
  }

  private categoryRows(items: CategoryReportItem[]): ReportRow[] {
    const grouped = new Map<string, ReportRow>();

    for (const item of items) {
      const key = item.menuItem.categoryId;
      const current = grouped.get(key);
      const amount = Number(item.total);

      if (current) {
        current.quantity += item.quantity;
        current.amount += amount;
      } else {
        grouped.set(key, {
          id: `category-${key}`,
          date: this.formatDate(item.createdAt),
          type: 'Categoria vendida',
          employee: 'Todos',
          table: 'Todas',
          category: item.menuItem.category.name,
          categoryId: key,
          concept: item.menuItem.category.name,
          quantity: item.quantity,
          amount
        });
      }
    }

    return Array.from(grouped.values());
  }

  private summary(rows: ReportRow[]) {
    return {
      salesTotal: rows.filter((row) => row.amount > 0 && ['Venta', 'Producto vendido', 'Categoria vendida', 'Cierre de caja'].includes(row.type)).reduce((sum, row) => sum + row.amount, 0),
      discountsTotal: Math.abs(rows.filter((row) => row.type === 'Descuento aplicado').reduce((sum, row) => sum + row.amount, 0)),
      cancellationsTotal: Math.abs(rows.filter((row) => row.type === 'Cancelacion').reduce((sum, row) => sum + row.amount, 0)),
      cashClosings: rows.filter((row) => row.type === 'Cierre de caja').reduce((sum, row) => sum + row.amount, 0),
      rowCount: rows.length
    };
  }

  private discountAmount(subtotal: number, type: string, value: number) {
    return type === 'PERCENTAGE' ? Math.min(subtotal, subtotal * (value / 100)) : Math.min(subtotal, value);
  }

  private async options() {
    const [waiters, tables, categories] = await Promise.all([
      this.prisma.user.findMany({ orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] }),
      this.prisma.restaurantTable.findMany({ orderBy: { number: 'asc' } }),
      this.prisma.menuCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
    ]);

    return {
      waiters: waiters.map((waiter) => ({ id: waiter.id, name: this.userName(waiter) })),
      tables: tables.map((table) => ({ id: table.id, name: this.tableName(table) })),
      categories: categories.map((category) => ({ id: category.id, name: category.name })),
      paymentMethods: Object.values(PaymentMethod),
      reportTypes: ['Todos', 'Venta', 'Producto vendido', 'Categoria vendida', 'Descuento aplicado', 'Cancelacion', 'Inventario bajo', 'Cierre de caja']
    };
  }

  private dateRange(query: ReportQuery) {
    const start = query.startDate ? new Date(`${query.startDate}T00:00:00`) : new Date(new Date().toISOString().slice(0, 10));
    const end = query.endDate ? new Date(`${query.endDate}T23:59:59.999`) : new Date(`${new Date().toISOString().slice(0, 10)}T23:59:59.999`);

    return { gte: start, lte: end };
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private userName(user?: { firstName?: string | null; lastName?: string | null; email: string } | null) {
    return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'N/A';
  }

  private tableName(table?: { name: string; number: string } | null) {
    return table ? `${table.name} ${table.number}` : 'N/A';
  }
}
