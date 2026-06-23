import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UserRole } from '@prisma/client';
import { hasRequiredRole } from '../auth/access-control';

const menuManagers = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] as const;
const menuViewers = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.WAITER,
  UserRole.KITCHEN
] as const;

describe('menu access rules', () => {
  it('allows admins and managers to modify menu data', () => {
    assert.equal(hasRequiredRole(UserRole.ADMIN, menuManagers), true);
    assert.equal(hasRequiredRole(UserRole.MANAGER, menuManagers), true);
  });

  it('blocks waiters and kitchen from modifying menu data', () => {
    assert.equal(hasRequiredRole(UserRole.WAITER, menuManagers), false);
    assert.equal(hasRequiredRole(UserRole.KITCHEN, menuManagers), false);
  });

  it('allows waiters and kitchen to read available menu data', () => {
    assert.equal(hasRequiredRole(UserRole.WAITER, menuViewers), true);
    assert.equal(hasRequiredRole(UserRole.KITCHEN, menuViewers), true);
  });
});
