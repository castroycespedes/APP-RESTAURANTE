import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UserRole } from '@prisma/client';
import { hasRequiredRole } from '../auth/access-control';

const printManagers = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] as const;
const printOperators = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN] as const;

describe('print access rules', () => {
  it('allows kitchen users to enqueue kitchen print jobs', () => {
    assert.equal(hasRequiredRole(UserRole.KITCHEN, printOperators), true);
  });

  it('allows only managers and admins to configure printers', () => {
    assert.equal(hasRequiredRole(UserRole.ADMIN, printManagers), true);
    assert.equal(hasRequiredRole(UserRole.KITCHEN, printManagers), false);
  });

  it('blocks cashiers from kitchen print queue operations', () => {
    assert.equal(hasRequiredRole(UserRole.CASHIER, printOperators), false);
  });
});
