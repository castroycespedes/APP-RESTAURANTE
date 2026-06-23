import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UserRole } from '@prisma/client';
import { hasRequiredRole } from '../auth/access-control';

const waiterOnly = [UserRole.WAITER] as const;
const orderOperators = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER] as const;
const correctionManagers = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] as const;

describe('orders access rules', () => {
  it('allows waiters to open and send their orders', () => {
    assert.equal(hasRequiredRole(UserRole.WAITER, waiterOnly), true);
  });

  it('allows managers to make corrections after kitchen send', () => {
    assert.equal(hasRequiredRole(UserRole.ADMIN, correctionManagers), true);
    assert.equal(hasRequiredRole(UserRole.MANAGER, correctionManagers), true);
  });

  it('blocks kitchen and cashier from waiter order operations', () => {
    assert.equal(hasRequiredRole(UserRole.KITCHEN, orderOperators), false);
    assert.equal(hasRequiredRole(UserRole.CASHIER, orderOperators), false);
  });
});
