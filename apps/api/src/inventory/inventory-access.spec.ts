import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UserRole } from '@prisma/client';
import { hasRequiredRole } from '../auth/access-control';

const inventoryOperators = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY] as const;

describe('inventory access rules', () => {
  it('allows inventory users to manage ingredients and recipes', () => {
    assert.equal(hasRequiredRole(UserRole.INVENTORY, inventoryOperators), true);
  });

  it('allows managers to review stock and movements', () => {
    assert.equal(hasRequiredRole(UserRole.MANAGER, inventoryOperators), true);
  });

  it('blocks waiters and kitchen from inventory administration', () => {
    assert.equal(hasRequiredRole(UserRole.WAITER, inventoryOperators), false);
    assert.equal(hasRequiredRole(UserRole.KITCHEN, inventoryOperators), false);
  });
});
