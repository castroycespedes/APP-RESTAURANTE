import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UserRole } from '@prisma/client';
import { hasRequiredRole } from '../auth/access-control';

const cashierRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] as const;
const discountManagers = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] as const;

describe('cashier access rules', () => {
  it('allows cashiers, managers and admins to charge orders', () => {
    assert.equal(hasRequiredRole(UserRole.CASHIER, cashierRoles), true);
    assert.equal(hasRequiredRole(UserRole.MANAGER, cashierRoles), true);
    assert.equal(hasRequiredRole(UserRole.ADMIN, cashierRoles), true);
  });

  it('blocks waiters and kitchen from cashier operations', () => {
    assert.equal(hasRequiredRole(UserRole.WAITER, cashierRoles), false);
    assert.equal(hasRequiredRole(UserRole.KITCHEN, cashierRoles), false);
  });

  it('reserves high-discount authorization for managers and admins', () => {
    assert.equal(hasRequiredRole(UserRole.MANAGER, discountManagers), true);
    assert.equal(hasRequiredRole(UserRole.CASHIER, discountManagers), false);
  });
});
