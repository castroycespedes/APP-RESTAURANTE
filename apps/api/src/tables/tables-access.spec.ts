import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UserRole } from '@prisma/client';
import { hasRequiredRole } from '../auth/access-control';

const tableManagers = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] as const;
const tableViewers = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER] as const;

describe('tables access rules', () => {
  it('allows admins and managers to manage tables', () => {
    assert.equal(hasRequiredRole(UserRole.ADMIN, tableManagers), true);
    assert.equal(hasRequiredRole(UserRole.MANAGER, tableManagers), true);
  });

  it('blocks waiters from editing the visual map', () => {
    assert.equal(hasRequiredRole(UserRole.WAITER, tableManagers), false);
  });

  it('allows waiters to see table data through waiter-scoped endpoints', () => {
    assert.equal(hasRequiredRole(UserRole.WAITER, tableViewers), true);
  });
});
