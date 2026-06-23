import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { DiscountType, UserRole } from '@prisma/client';
import { CashierService } from './cashier.service';

interface CashierServiceInternals {
  calculateDiscountAmount: (subtotal: number, type: DiscountType, value: number) => number;
  ensureDiscountAllowed: (role: UserRole, type: DiscountType, value: number, discountAmount: number) => Promise<void>;
}

function createService() {
  return new CashierService({
    appSetting: {
      findUnique: async ({ where }: { where: { key: string } }) => {
        if (where.key === 'discount_manager_percent_threshold') return { value: '10' };
        if (where.key === 'discount_manager_amount_threshold') return { value: '50000' };

        return null;
      }
    }
  } as never, {} as never) as unknown as CashierServiceInternals;
}

describe('CashierService unit rules', () => {
  it('calculates percentage and fixed discounts without exceeding subtotal', () => {
    const service = createService();

    assert.equal(service.calculateDiscountAmount(100000, DiscountType.PERCENTAGE, 10), 10000);
    assert.equal(service.calculateDiscountAmount(50000, DiscountType.FIXED_AMOUNT, 70000), 50000);
  });

  it('allows small discounts for cashiers', async () => {
    const service = createService();

    await assert.doesNotReject(() => service.ensureDiscountAllowed(UserRole.CASHIER, DiscountType.PERCENTAGE, 5, 5000));
  });

  it('requires manager or admin permission for high discounts', async () => {
    const service = createService();

    await assert.rejects(
      () => service.ensureDiscountAllowed(UserRole.CASHIER, DiscountType.PERCENTAGE, 20, 20000),
      ForbiddenException
    );
    await assert.doesNotReject(() => service.ensureDiscountAllowed(UserRole.MANAGER, DiscountType.PERCENTAGE, 20, 20000));
  });
});
