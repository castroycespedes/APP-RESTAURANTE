import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UserRole } from '@prisma/client';
import {
  ADMIN_PANEL_ROLES,
  CASHIER_ROLES,
  KITCHEN_ROLES,
  hasRequiredPermissions,
  hasRequiredRole
} from './access-control';

describe('access control role groups', () => {
  it('blocks waiters from the admin panel', () => {
    assert.equal(hasRequiredRole(UserRole.WAITER, ADMIN_PANEL_ROLES), false);
  });

  it('allows kitchen users only in kitchen-capable routes', () => {
    assert.equal(hasRequiredRole(UserRole.KITCHEN, KITCHEN_ROLES), true);
    assert.equal(hasRequiredRole(UserRole.KITCHEN, CASHIER_ROLES), false);
  });

  it('allows cashiers in cashier-capable routes', () => {
    assert.equal(hasRequiredRole(UserRole.CASHIER, CASHIER_ROLES), true);
    assert.equal(hasRequiredRole(UserRole.CASHIER, KITCHEN_ROLES), false);
  });

  it('requires backend permissions in addition to the role', () => {
    assert.equal(hasRequiredPermissions(['tables:read'], ['tables:read']), true);
    assert.equal(hasRequiredPermissions(['menu:manage'], ['menu:read']), true);
    assert.equal(hasRequiredPermissions(['payments:read'], ['reports:read']), false);
    assert.equal(hasRequiredPermissions(['*'], ['users:manage', 'reports:read']), true);
  });
});
