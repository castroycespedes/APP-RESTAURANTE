import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UserRole } from '@prisma/client';
import { hasRequiredRole } from '../auth/access-control';

const kitchenOperators = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN] as const;
const cashierOnly = [UserRole.CASHIER] as const;

describe('kitchen access rules', () => {
  it('allows kitchen users to operate kitchen tickets', () => {
    assert.equal(hasRequiredRole(UserRole.KITCHEN, kitchenOperators), true);
  });

  it('blocks kitchen users from cashier-only operations', () => {
    assert.equal(hasRequiredRole(UserRole.KITCHEN, cashierOnly), false);
  });

  it('blocks waiters from kitchen ticket updates', () => {
    assert.equal(hasRequiredRole(UserRole.WAITER, kitchenOperators), false);
  });
});
