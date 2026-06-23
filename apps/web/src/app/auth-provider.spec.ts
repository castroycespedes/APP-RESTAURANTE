import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { routeForRole, type UserRole } from './auth-provider';

describe('protected route mapping', () => {
  it('routes administrative roles to the admin panel', () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] satisfies UserRole[]) {
      assert.equal(routeForRole(role), '/admin');
    }
  });

  it('routes operational roles to their own workspaces', () => {
    assert.equal(routeForRole('WAITER'), '/mesero/pedidos');
    assert.equal(routeForRole('KITCHEN'), '/cocina/kanban');
    assert.equal(routeForRole('CASHIER'), '/caja');
    assert.equal(routeForRole('INVENTORY'), '/inventario');
  });
});
