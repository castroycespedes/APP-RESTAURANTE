import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import { OrdersService } from './orders.service';

interface OrdersServiceInternals {
  calculateItemTotal: (
    unitPrice: number,
    quantity: number,
    modifiers: Array<{ priceDelta: Prisma.Decimal | number; quantity: number }>
  ) => Prisma.Decimal;
  ensureOrderEditable: (status: OrderStatus) => void;
  ensureCorrectionAllowed: (sentCorrection: boolean, reason: string | undefined, user: { role: UserRole }) => void;
}

function createService() {
  return new OrdersService({} as never, {} as never, {} as never, {} as never) as unknown as OrdersServiceInternals;
}

describe('OrdersService unit rules', () => {
  it('calculates item totals with modifiers', () => {
    const service = createService();

    assert.equal(Number(service.calculateItemTotal(25000, 2, [{ priceDelta: 3000, quantity: 1 }])), 56000);
  });

  it('blocks edits on closed or cancelled orders', () => {
    const service = createService();

    assert.throws(() => service.ensureOrderEditable(OrderStatus.CLOSED), ConflictException);
    assert.throws(() => service.ensureOrderEditable(OrderStatus.CANCELLED), ConflictException);
    assert.doesNotThrow(() => service.ensureOrderEditable(OrderStatus.OPEN));
  });

  it('requires manager permission and a reason for kitchen corrections', () => {
    const service = createService();

    assert.throws(
      () => service.ensureCorrectionAllowed(true, 'Cambio solicitado', { role: UserRole.WAITER }),
      /manager permission/
    );
    assert.throws(
      () => service.ensureCorrectionAllowed(true, undefined, { role: UserRole.MANAGER }),
      /require a reason/
    );
    assert.doesNotThrow(() => service.ensureCorrectionAllowed(true, 'Error de digitacion', { role: UserRole.MANAGER }));
  });
});
